"""Public read without listing: anonymous GET of churches/* and libraries/* only.

usage: S3_ACCESS_KEY=... S3_SECRET_KEY=... python -I publicRead.py <endpoint>
Needs boto3 (a throwaway venv). Sets a standard AWS bucket policy, then reads
and lists without credentials. SeaweedFS 4.54 (Windows build): all as wanted.
"""
import json, os, sys, urllib.request, urllib.error
import boto3
from botocore.config import Config

endpoint, bucket = sys.argv[1], 'church-hub-spike'
s3 = boto3.client('s3', endpoint_url=endpoint, aws_access_key_id=os.environ['S3_ACCESS_KEY'],
                  aws_secret_access_key=os.environ['S3_SECRET_KEY'], region_name='us-east-1',
                  config=Config(s3={'addressing_style': 'path'}))
try: s3.create_bucket(Bucket=bucket)
except s3.exceptions.BucketAlreadyOwnedByYou: pass
for key in ['churches/c1/segments/000001.json.gz', 'libraries/l1/snapshot.json.gz', 'private/backup.db']:
    s3.put_object(Bucket=bucket, Key=key, Body=b'{}')
policy = {'Version': '2012-10-17', 'Statement': [{
    'Effect': 'Allow', 'Principal': '*', 'Action': ['s3:GetObject'],
    'Resource': [f'arn:aws:s3:::{bucket}/churches/*', f'arn:aws:s3:::{bucket}/libraries/*']}]}
s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
print('policy stored:', json.loads(s3.get_bucket_policy(Bucket=bucket)['Policy'])['Statement'][0]['Action'])

def anon(path):
    try:
        with urllib.request.urlopen(f'{endpoint}/{bucket}{path}') as r: return r.status
    except urllib.error.HTTPError as e: return e.code

checks = {
    'GET churches/... (want 200)': anon('/churches/c1/segments/000001.json.gz'),
    'GET libraries/... (want 200)': anon('/libraries/l1/snapshot.json.gz'),
    'GET private/... (want 403)': anon('/private/backup.db'),
    'LIST bucket (want 403)': anon('/?list-type=2'),
    'LIST prefix churches/ (want 403)': anon('/?list-type=2&prefix=churches/'),
}
for name, status in checks.items(): print(f'{status}  {name}')
