import { spawn } from 'node:child_process';
import net from 'node:net';
export async function startServer(directory, port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
  const child = spawn('python3', ['-u', '-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', directory], { stdio: ['ignore','pipe','pipe'] });
  const stop = async () => {
    if (child.exitCode !== null) return;
    await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
  };
  try {
    await new Promise((resolve,reject)=>{
      let output='';
      const timer=setTimeout(()=>finish(Error('Server readiness timeout')),10000);
      const finish=error=>{clearTimeout(timer);child.stdout.off('data',onData);child.stderr.off('data',onData);child.off('exit',onExit);child.off('error',onError);error?reject(error):resolve();};
      const onData=chunk=>{output+=chunk.toString();if(output.includes('Serving HTTP on'))finish();};
      const onExit=code=>finish(Error(`Server exited ${code}: ${output}`));
      const onError=error=>finish(error);
      child.stdout.on('data',onData);child.stderr.on('data',onData);child.once('exit',onExit);child.once('error',onError);
    });
    if(!(await fetch(`http://127.0.0.1:${port}`)).ok)throw Error('Ready server returned non-success HTTP');
    return {stop,pid:child.pid};
  } catch (error) { await stop(); throw error; }
}
