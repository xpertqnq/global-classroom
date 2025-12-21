/**
 * Utility to merge multiple audio blobs into a single audio file.
 */

/**
 * Merges multiple WebM/Ogg/WAV blobs into a single WAV blob using Web Audio API.
 * Note: Browser MediaRecorder usually produces WebM or Ogg. 
 * For simplicity and broad compatibility, this mixer decodes them and creates a single PCM WAV.
 */
export async function mergeAudioBlobs(blobs: Blob[]): Promise<Blob> {
    if (blobs.length === 0) {
        throw new Error('No audio blobs to merge');
    }

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Decode all blobs into AudioBuffers
    const audioBuffers: AudioBuffer[] = await Promise.all(
        blobs.map(async (blob) => {
            const arrayBuffer = await blob.arrayBuffer();
            return await audioCtx.decodeAudioData(arrayBuffer);
        })
    );

    // Calculate total length
    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const numberOfChannels = audioBuffers[0].numberOfChannels;
    const sampleRate = audioBuffers[0].sampleRate;

    // Create a new buffer for the merged audio
    const mergedBuffer = audioCtx.createBuffer(numberOfChannels, totalLength, sampleRate);

    // Copy data from each buffer into the merged buffer
    let offset = 0;
    for (const buffer of audioBuffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            mergedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
        }
        offset += buffer.length;
    }

    // Convert merged AudioBuffer to WAV Blob
    return audioBufferToWav(mergedBuffer);
}

/**
 * Encodes AudioBuffer into a WAV formatted Blob.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let result: Int16Array;

    if (numberOfChannels === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = floatTo16BitPCM(buffer.getChannelData(0));
    }

    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + result.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, result.length * 2, true);

    const container = new Uint8Array(header.byteLength + result.byteLength);
    container.set(new Uint8Array(header), 0);
    container.set(new Uint8Array(result.buffer), header.byteLength);

    return new Blob([container], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Int16Array {
    const length = inputL.length + inputR.length;
    const result = new Int16Array(length);

    let index = 0;
    let inputIndex = 0;

    while (index < length) {
        result[index++] = Math.max(-1, Math.min(1, inputL[inputIndex])) * 0x7FFF;
        result[index++] = Math.max(-1, Math.min(1, inputR[inputIndex])) * 0x7FFF;
        inputIndex++;
    }
    return result;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
    const result = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        result[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF;
    }
    return result;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
