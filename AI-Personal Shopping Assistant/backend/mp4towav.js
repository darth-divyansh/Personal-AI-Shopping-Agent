import { exec } from "child_process";
import { promisify } from "util";
const execCommand = promisify(exec);

/**
 * Converts an audio or video file to WAV.
 * @param {string} inputPath - Path to input file (e.g., .mp4, .m4a)
 * @param {string} outputPath - Desired path for .wav file
 */
const convertToWav = async (inputPath, outputPath) => {
  const cmd = `ffmpeg -y -i "${inputPath}" -acodec pcm_s16le -ar 44100 "${outputPath}"`;
  try {
    await execCommand(cmd);
    console.log(`✅ Converted to WAV: ${outputPath}`);
  } catch (err) {
    console.error("❌ Conversion failed:", err.stderr || err);
  }
};

// Example usage:
convertToWav("./audios/wally_hello3.mp4", "./audios/wally_hello3.wav");
// or
