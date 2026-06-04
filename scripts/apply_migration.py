#!/usr/bin/env python3
import paramiko, sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('5.252.53.169', username='root', password='Rodonet7012', timeout=15)

sql_file = sys.argv[1]
DB = 'supabase-db-h8occ6uko144qwdes4o43t7r'

sftp = ssh.open_sftp()
sftp.put(f'supabase/migrations/{sql_file}', f'/tmp/{sql_file}')
sftp.close()

stdin, stdout, stderr = ssh.exec_command(f'docker cp /tmp/{sql_file} {DB}:/tmp/{sql_file}')
stdout.channel.recv_exit_status()

stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {DB} psql -U supabase_admin -d postgres -f /tmp/{sql_file} 2>&1'
)
exit_status = stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))
print('Exit:', exit_status)
ssh.close()
