import json
import os
import boto3
import traceback
from datetime import datetime, timezone
from decimal import Decimal

ec2 = boto3.client('ec2', region_name='ap-south-1')
dynamodb = boto3.resource('dynamodb', region_name='ap-south-1')
table = dynamodb.Table('FinOps_Audit_Logs')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST',
    'Content-Type': 'application/json'
}

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def format_response(status_code, body):
    return {
        'statusCode': int(status_code),
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=decimal_default)
    }

def lambda_handler(event, context):
    print('Incoming Event:', json.dumps(event))
    try:
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')

        if http_method == 'OPTIONS':
            return format_response(200, {'status': 'ok'})

        # Route 1: Instances (GET)
        if http_method == 'GET' and 'instances' in path:
            return get_live_instances()

        # Route 2: Single Action (POST)
        if http_method == 'POST' and 'action' in path and 'bulk' not in path:
            body_raw = event.get('body') or '{}'
            body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
            return execute_instance_action(body.get('instanceId'), body.get('action'))

        # Route 3: Bulk Action (POST)
        if http_method == 'POST' and 'bulk-action' in path:
            body_raw = event.get('body') or '{}'
            body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
            return execute_bulk_action(body.get('targetEnv', 'dev'), body.get('action', 'STOP'))

        # Route 4: Update Tag (POST)
        if http_method == 'POST' and 'tag' in path:
            body_raw = event.get('body') or '{}'
            body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
            return update_instance_tag(body.get('instanceId'), body.get('tagKey'), body.get('tagValue'))

        # Route 5: Audit Logs (GET)
        if http_method == 'GET' and 'audit-logs' in path:
            return get_audit_logs()

        return format_response(404, {'error': f'Route not found: {http_method} {path}'})

    except Exception as e:
        err_msg = traceback.format_exc()
        print('FATAL ERROR:', err_msg)
        return format_response(500, {'error': str(e), 'trace': err_msg})

def get_live_instances():
    response = ec2.describe_instances(
        Filters=[{'Name': 'tag:Name', 'Values': ['FinOps-Dev-Server', 'FinOps-Prod-Server']}]
    )
    instances = []
    for res in response.get('Reservations', []):
        for inst in res.get('Instances', []):
            tags = {t.get('Key'): t.get('Value') for t in inst.get('Tags', [])}
            instances.append({
                'id': inst['InstanceId'],
                'name': tags.get('Name', 'Unknown'),
                'type': inst.get('InstanceType', 't3.micro'),
                'env': tags.get('Environment', 'dev'),
                'autoSchedule': tags.get('AutoSchedule', 'false'),
                'owner': tags.get('Owner', 'DevOps Team'),
                'status': inst['State']['Name'].capitalize(),
                'schedule': '09:00 - 19:00 UTC' if tags.get('AutoSchedule') == 'true' else 'Always On',
                'tags': tags
            })
    return format_response(200, instances)

def execute_instance_action(instance_id, action):
    if not instance_id or not action:
        return format_response(400, {'error': 'instanceId and action required'})

    desc = ec2.describe_instances(InstanceIds=[instance_id])
    inst = desc['Reservations'][0]['Instances'][0]
    tags = {t.get('Key'): t.get('Value') for t in inst.get('Tags', [])}

    if tags.get('Environment') == 'prod':
        return format_response(403, {'error': 'Production instances are protected by guardrails.'})

    now_iso = datetime.now(timezone.utc).isoformat()

    if action.upper() == 'STOP':
        ec2.stop_instances(InstanceIds=[instance_id])
        table.put_item(Item={
            'InstanceId': instance_id,
            'Timestamp': now_iso,
            'Action': 'MANUAL_STOP',
            'TriggeredBy': 'Web_Dashboard_User',
            'EstimatedSavingsUSD': '0.125',
            'Status': 'SUCCESS'
        })
    elif action.upper() == 'START':
        ec2.start_instances(InstanceIds=[instance_id])
        table.put_item(Item={
            'InstanceId': instance_id,
            'Timestamp': now_iso,
            'Action': 'MANUAL_START',
            'TriggeredBy': 'Web_Dashboard_User',
            'EstimatedSavingsUSD': '0.000',
            'Status': 'SUCCESS'
        })

    return format_response(200, {'success': True, 'instanceId': instance_id, 'action': action})

def execute_bulk_action(target_env, action):
    if target_env.lower() == 'prod':
        return format_response(403, {'error': 'Bulk modification of prod instances is rejected.'})

    res = get_live_instances()
    inst_list = json.loads(res['body'])
    targeted = [i['id'] for i in inst_list if i['env'] == target_env]

    if not targeted:
        return format_response(200, {'message': 'No matching instances found', 'count': 0})

    now_iso = datetime.now(timezone.utc).isoformat()
    if action.upper() == 'STOP':
        ec2.stop_instances(InstanceIds=targeted)
        for i_id in targeted:
            table.put_item(Item={
                'InstanceId': i_id,
                'Timestamp': now_iso,
                'Action': 'BULK_STOP',
                'TriggeredBy': 'Emergency_Action',
                'EstimatedSavingsUSD': '0.125',
                'Status': 'SUCCESS'
            })
    elif action.upper() == 'START':
        ec2.start_instances(InstanceIds=targeted)

    return format_response(200, {'success': True, 'count': len(targeted), 'action': action})

def update_instance_tag(instance_id, tag_key, tag_value):
    if not instance_id or not tag_key:
        return format_response(400, {'error': 'Missing instanceId or tagKey'})

    # Prevent removing prod protection
    if tag_key == 'Environment' and tag_value == 'dev':
        desc = ec2.describe_instances(InstanceIds=[instance_id])
        curr_tags = {t.get('Key'): t.get('Value') for t in desc['Reservations'][0]['Instances'][0].get('Tags', [])}
        if curr_tags.get('Environment') == 'prod':
            return format_response(403, {'error': 'Cannot downgrade production environment guardrails.'})

    ec2.create_tags(
        Resources=[instance_id],
        Tags=[{'Key': tag_key, 'Value': str(tag_value)}]
    )

    table.put_item(Item={
        'InstanceId': instance_id,
        'Timestamp': datetime.now(timezone.utc).isoformat(),
        'Action': f'UPDATE_TAG_{tag_key.upper()}={tag_value}',
        'TriggeredBy': 'Tag_Governance_Engine',
        'EstimatedSavingsUSD': '0.000',
        'Status': 'SUCCESS'
    })

    return format_response(200, {'success': True, 'instanceId': instance_id, 'tag': {tag_key: tag_value}})

def get_audit_logs():
    data = table.scan(Limit=50)
    items = data.get('Items', [])
    sorted_items = sorted(items, key=lambda x: str(x.get('Timestamp', '')), reverse=True)
    return format_response(200, sorted_items)
