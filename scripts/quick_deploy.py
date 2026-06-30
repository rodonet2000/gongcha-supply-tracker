#!/usr/bin/env python3
"""Fast deploy: pull latest, build image, update container, fix Traefik IP."""
import paramiko, time, json, sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('5.252.53.169', username='root', password='Rodonet7012', timeout=20)

def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err, exit_status

APP_DIR = '/data/coolify/applications/vcdnk6xkka5qk3btoaqdxv9e'
APP_CONTAINER = 'vcdnk6xkka5qk3btoaqdxv9e-220218516198'
BUILD_DIR = '/tmp/gongcha-build'

# 1. Pull latest
print('1. Pulling latest code...')
out, err, rc = run(f'git -C {BUILD_DIR} pull origin master 2>&1')
print(out.strip()[-200:])

# Get new commit hash
out, _, _ = run(f'git -C {BUILD_DIR} rev-parse --short HEAD')
commit = out.strip()
IMAGE = f'vcdnk6xkka5qk3btoaqdxv9e:{commit}'
print(f'   Commit: {commit}')

# 2. Build image
print(f'2. Building {IMAGE} ...')
out, err, rc = run(f'docker build -t {IMAGE} {BUILD_DIR} 2>&1 | tail -3', timeout=600)
print(out.strip())
if rc != 0:
    print('BUILD FAILED:', err[:200])
    sys.exit(1)

# 3. Update docker-compose image tag
print('3. Updating docker-compose...')
out, _, _ = run(f'cat {APP_DIR}/docker-compose.yaml')
content = out

# Replace old image tag
import re
new_content = re.sub(
    r"image: 'vcdnk6xkka5qk3btoaqdxv9e:[a-f0-9]+'",
    f"image: '{IMAGE}'",
    content
)
# Write via heredoc approach
sftp = ssh.open_sftp()
with sftp.open(f'{APP_DIR}/docker-compose.yaml', 'w') as f:
    f.write(new_content)
sftp.close()
print(f'   Updated to {IMAGE}')

# 4. Recreate container
print('4. Recreating container...')
out, err, rc = run(f'cd {APP_DIR} && docker compose up -d --force-recreate 2>&1', timeout=60)
print(out.strip()[-300:])

time.sleep(10)

# 5. Get new container IP
out, _, _ = run(
    f'docker inspect {APP_CONTAINER} '
    f'--format="{{{{.NetworkSettings.Networks.coolify.IPAddress}}}}"'
)
new_ip = out.strip()
print(f'5. New container IP: {new_ip}')

# 6. Update Traefik config
TRAEFIK_FILE = '/data/coolify/proxy/dynamic/gongcha.yml'
out, _, _ = run(f'cat {TRAEFIK_FILE}')
old_content = out

import re
updated = re.sub(r'http://\d+\.\d+\.\d+\.\d+:3000', f'http://{new_ip}:3000', old_content)
sftp = ssh.open_sftp()
with sftp.open(TRAEFIK_FILE, 'w') as f:
    f.write(updated)
sftp.close()
print(f'   Traefik updated')

# 7. Verify
time.sleep(5)
out, _, _ = run(
    f'docker ps --filter name={APP_CONTAINER} --format "{{{{.Names}}}} {{{{.Status}}}} {{{{.Image}}}}"'
)
print(f'7. Container: {out.strip()}')

# 8. Quick smoke test via curl
time.sleep(5)
out, _, _ = run(
    'curl -sv --max-time 8 -o /dev/null https://gongcha.rodosoft.digital/login 2>&1 | grep "< HTTP"'
)
print(f'8. Login page: {out.strip()}')

ssh.close()
print('\nDone!')
