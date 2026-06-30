#!/usr/bin/env python3
"""Resolve host-port collision: another app (facturacion-prod) now owns 3100.
Move ONLY gongcha's host port mapping to a free port. Does not touch
facturacion-prod or any other app/container/config."""
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

# 0. Remove the orphaned "Created" (never started) container first
print("=== 0. Removing orphaned Created container ===")
out, rc = run(f'docker rm {CONTAINER} 2>&1')
print(out.strip())

# 1. Find a free host port near 3100
print("\n=== 1. Finding a free port ===")
used_ports = set()
out, _ = run("docker ps -a --format '{{.Ports}}' | grep -oE '0\\.0\\.0\\.0:[0-9]+' | cut -d: -f2")
for line in out.strip().split('\n'):
    if line.strip().isdigit():
        used_ports.add(int(line.strip()))
print("Ports currently in use:", sorted(used_ports))

free_port = None
for candidate in range(3100, 3200):
    if candidate not in used_ports:
        free_port = candidate
        break
print("Selected free port:", free_port)

# 2. Update docker-compose.yaml (ONLY the ports line for this app)
print("\n=== 2. Updating docker-compose.yaml port mapping ===")
out, _ = run(f'cat {APP_DIR}/docker-compose.yaml')
content = out
new_content = re.sub(r"- '3100:3000'", f"- '{free_port}:3000'", content)
if new_content == content:
    print("WARNING: pattern '3100:3000' not found, no change made")
else:
    sftp = ssh.open_sftp()
    with sftp.open(f'{APP_DIR}/docker-compose.yaml', 'w') as f:
        f.write(new_content)
    sftp.close()
    print(f"Updated port mapping: 3100:3000 -> {free_port}:3000")

# 3. Bring up the container
print("\n=== 3. Starting container ===")
out, rc = run(f'cd {APP_DIR} && docker compose up -d 2>&1', timeout=60)
print(out)
print("Exit:", rc)

time.sleep(8)

print("\n=== 4. Container status ===")
out, _ = run(f'docker ps --filter name={CONTAINER} --format "{{{{.Names}}}} {{{{.Status}}}} {{{{.Ports}}}}"')
print(out.strip())

if CONTAINER not in out:
    print("\nERROR: container still not running.")
    out, _ = run(f'docker logs {CONTAINER} --tail=40 2>&1')
    print(out)
    ssh.close()
    sys.exit(1)

# 5. Get new IP and fix Traefik
print("\n=== 5. New container IP ===")
out, _ = run(f'docker inspect {CONTAINER} --format="{{{{.NetworkSettings.Networks.coolify.IPAddress}}}}"')
new_ip = out.strip()
print("IP:", new_ip)

print("\n=== 6. Updating Traefik gongcha.yml ===")
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

print("\n=== 7. Verification: /login ===")
out, _ = run('curl -s -o /dev/null -w "HTTP %{http_code}\\n" --max-time 10 https://gongcha.rodosoft.digital/login')
print(out.strip())

print("\n=== 8. App startup logs ===")
out, _ = run(f'docker logs {CONTAINER} --tail=25 2>&1')
print(out)

print("\n=== 9. Confirm facturacion-prod untouched ===")
out, _ = run('docker ps --filter name=facturacion-prod --format "{{.Names}} {{.Status}} {{.Ports}}"')
print(out.strip())

ssh.close()
