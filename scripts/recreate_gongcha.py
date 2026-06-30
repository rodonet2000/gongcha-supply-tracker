#!/usr/bin/env python3
"""Recreate the gongcha container from its EXISTING docker-compose.yaml
(already on disk, written by Coolify's last deploy). Does not rebuild,
does not touch other apps' containers/configs."""
import paramiko, sys, re, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('5.252.53.169', username='root', password='Rodonet7012', timeout=20)

def run(cmd, timeout=60):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    rc = stdout.channel.recv_exit_status()
    return (stdout.read() + stderr.read()).decode('utf-8', errors='replace'), rc

APP_DIR = '/data/coolify/applications/vcdnk6xkka5qk3btoaqdxv9e'
CONTAINER = 'vcdnk6xkka5qk3btoaqdxv9e-173603267446'

print(f"=== Bringing up {CONTAINER} from existing docker-compose.yaml ===")
out, rc = run(f'cd {APP_DIR} && docker compose up -d 2>&1', timeout=60)
print(out)
print("Exit:", rc)

time.sleep(8)

print("\n=== Container status ===")
out, _ = run(f'docker ps --filter name={CONTAINER} --format "{{{{.Names}}}} {{{{.Status}}}}"')
print(out.strip())

if CONTAINER not in out:
    print("\nERROR: container still not running. Checking logs...")
    out, _ = run(f'docker logs {CONTAINER} --tail=40 2>&1')
    print(out)
    ssh.close()
    sys.exit(1)

print("\n=== New container IP ===")
out, _ = run(f'docker inspect {CONTAINER} --format="{{{{.NetworkSettings.Networks.coolify.IPAddress}}}}"')
new_ip = out.strip()
print("IP:", new_ip)

print("\n=== Updating Traefik gongcha.yml ===")
out, _ = run('cat /data/coolify/proxy/dynamic/gongcha.yml')
config = out
old_ip_match = re.search(r'http://(\d+\.\d+\.\d+\.\d+):3000', config)
old_ip = old_ip_match.group(1) if old_ip_match else None
print(f"Old IP: {old_ip} -> New IP: {new_ip}")

if old_ip != new_ip:
    new_config = config.replace(f'http://{old_ip}:3000', f'http://{new_ip}:3000')
    sftp = ssh.open_sftp()
    with sftp.open('/data/coolify/proxy/dynamic/gongcha.yml', 'w') as f:
        f.write(new_config)
    sftp.close()
    print("Traefik config updated.")
else:
    print("IPs already match.")

time.sleep(5)

print("\n=== Verification: /login ===")
out, _ = run('curl -s -o /dev/null -w "HTTP %{http_code}\\n" --max-time 10 https://gongcha.rodosoft.digital/login')
print(out.strip())

print("\n=== App startup logs ===")
out, _ = run(f'docker logs {CONTAINER} --tail=20 2>&1')
print(out)

ssh.close()
