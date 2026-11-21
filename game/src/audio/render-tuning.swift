import AVFoundation
import Foundation

let sampleRate = 48_000.0
let resolveTime = 3.0
let duration = 7.2
let bank = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
let destination = URL(fileURLWithPath: CommandLine.arguments[1])
let engine = AVAudioEngine()
let ensemble = AVAudioMixerNode()
let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
let hall = AVAudioUnitReverb()
hall.loadFactoryPreset(.largeHall)
hall.wetDryMix = 26
engine.attach(hall)
engine.attach(ensemble)
engine.connect(ensemble, to: hall, format: format)
engine.connect(hall, to: engine.mainMixerNode, format: format)

struct Part {
    let program: UInt8
    let note: UInt8
    let cents: Double
    let entry: Double
    let pan: Float
    let gain: Float
}
let parts: [Part] = [
    Part(program: 40, note: 69, cents: 105, entry: 0, pan: -0.65, gain: -14),
    Part(program: 40, note: 64, cents: -95, entry: 0.18, pan: 0.65, gain: -14),
    Part(program: 41, note: 61, cents: 85, entry: 0.34, pan: -0.3, gain: -12),
    Part(program: 42, note: 45, cents: -65, entry: 0.08, pan: 0.25, gain: -11),
    Part(program: 68, note: 64, cents: -110, entry: 0.52, pan: 0.4, gain: -22),
    Part(program: 48, note: 57, cents: 80, entry: 0.7, pan: -0.5, gain: -15),
    Part(program: 43, note: 33, cents: -10, entry: 2.75, pan: 0, gain: -17),
    Part(program: 42, note: 52, cents: 14, entry: 2.72, pan: 0.25, gain: -13),
    Part(program: 60, note: 57, cents: -16, entry: 2.75, pan: -0.3, gain: -10),
    Part(program: 60, note: 61, cents: -12, entry: 2.75, pan: 0, gain: -14),
    Part(program: 60, note: 64, cents: 12, entry: 2.75, pan: 0.3, gain: -12),
    Part(program: 56, note: 69, cents: 8, entry: 2.94, pan: 0.3, gain: -23)
]
var samplers: [AVAudioUnitSampler] = []
for part in parts {
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)
    try sampler.loadSoundBankInstrument(at: bank, program: part.program, bankMSB: 0x79, bankLSB: 0)
    sampler.stereoPan = part.pan
    sampler.overallGain = -80
    sampler.sendController(101, withValue: 0, onChannel: 0)
    sampler.sendController(100, withValue: 0, onChannel: 0)
    sampler.sendController(6, withValue: 2, onChannel: 0)
    engine.connect(sampler, to: ensemble, fromBus: 0, toBus: AVAudioNodeBus(samplers.count), format: format)
    samplers.append(sampler)
}
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 256)
engine.prepare()
try engine.start()
let block = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 256)!
let totalFrames = Int(duration * sampleRate)
var channels = [[Float](repeating: 0, count: totalFrames), [Float](repeating: 0, count: totalFrames)]
var started = Set<Int>()
var released = false
var frame = 0
while frame < totalFrames {
    let time = Double(frame) / sampleRate
    for (index, part) in parts.enumerated() where time >= part.entry {
        let sampler = samplers[index]
        let progress = min(1, max(0, (time - part.entry) / (resolveTime - part.entry)))
        let remaining = 1 - progress * progress * (3 - 2 * progress)
        let cents = part.cents * remaining + sin(time * 4.1 + Double(index)) * 7 * remaining
        sampler.sendPitchBend(UInt16(max(0, min(16383, 8192 + cents / 200 * 8192))), onChannel: 0)
        let entryFade = min(1, (time - part.entry) / 0.25)
        let swell = min(1, max(0, time / resolveTime))
        let tail = max(0, (time - 4.0) * 13)
        sampler.overallGain = part.gain - Float((1 - swell) * 15 + (1 - entryFade) * 35 + tail)
        if !started.contains(index) {
            sampler.startNote(part.note, withVelocity: 95, onChannel: 0)
            started.insert(index)
        }
        if time >= 4.8 && !released { sampler.stopNote(part.note, onChannel: 0) }
    }
    if time >= 4.8 { released = true }
    let resolutionFrame = Int(resolveTime * sampleRate)
    let count = min(256, totalFrames - frame, frame < resolutionFrame ? resolutionFrame - frame : 256)
    let status = try engine.renderOffline(AVAudioFrameCount(count), to: block)
    guard status == .success else { fatalError("Offline rendering failed: \(status)") }
    for channel in 0..<2 {
        for i in 0..<count { channels[channel][frame + i] = block.floatChannelData![channel][i] }
    }
    frame += count
}
engine.stop()
let peak = channels.flatMap { $0 }.reduce(Float(0)) { max($0, abs($1)) }
guard peak > 0.001 else { fatalError("Sampler produced silence") }
let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(totalFrames))!
output.frameLength = AVAudioFrameCount(totalFrames)
for channel in 0..<2 {
    for i in 0..<totalFrames {
        let fade = min(1, Float(totalFrames - i) / 9600)
        output.floatChannelData![channel][i] = channels[channel][i] * (0.78 / peak) * fade
    }
}
func writeCue() throws {
    let file = try AVAudioFile(forWriting: destination, settings: [
        AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: sampleRate,
        AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false
    ])
    try file.write(from: output)
}
try writeCue()
print("Rendered \(duration)s stereo cue, concert pitch at \(resolveTime)s, source peak \(peak)")
