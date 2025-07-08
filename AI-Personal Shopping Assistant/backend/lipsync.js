import { exec } from "child_process";
import { promises as fs, existsSync } from "fs";
import path from "path";

// helper function to run shell commands
const execCommand = (cmd) =>
  new Promise((res, rej) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return rej(stderr || err);
      res(stdout);
    });
  });

const generateLipSync = async (base) => {
  const inputMp3 = `audios/${base}.mp3`;
  const inputWav = `audios/${base}.wav`;
  const outputJson = `audios/${base}.json`;

  if (!existsSync(inputWav)) {
    console.log(`Converting ${inputMp3} → ${inputWav}`);
    await execCommand(`ffmpeg -y -i ${inputMp3} ${inputWav}`);
  }

  const rhubarbCmd =
    process.platform === "win32"
      ? `"bin\\rhubarb.exe" -f json -o audios\\${base}.json audios\\${base}.wav -r phonetic`
      : `./bin/rhubarb -f json -o audios/${base}.json audios/${base}.wav -r phonetic`;

  console.log(`Generating lip sync: ${outputJson}`);
  await execCommand(rhubarbCmd);
  console.log(`✅ Lip sync file created: ${outputJson}`);
};

// Accept command line arg: node generateLipsync.js api_0
const baseName = process.argv[2];
if (!baseName) {
  console.error("❌ Usage: node generateLipsync.js <baseName>");
  process.exit(1);
}

generateLipSync(baseName).catch((err) => {
  console.error("❌ Error:", err);
});




