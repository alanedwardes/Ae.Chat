export interface IUserMedia {
    GetMediaStream(): Promise<MediaStream>;
    GetSettings(): UserMediaSettings;
    SetSettings(newSettings: UserMediaSettings): Promise<void>;
    SampleInput(): number;
    OnMediaStreamAvailable: OnMediaStreamAvailable;
}

export enum UserMediaSettingType {
    Generic,
    Range,
    Select
}

export interface IUserMediaSetting {
    readonly Name: string;
    readonly Description: string;
    readonly Category: string;
    readonly Hidden: boolean;
    readonly Type: UserMediaSettingType;
    readonly Value: any;
}

export class UserMediaSetting<T> implements IUserMediaSetting {
    constructor(value: T, name: string, description: string, category: string, hidden: boolean) {
        this.Name = name;
        this.Description = description;
        this.Category = category;
        this.Hidden = hidden;
        this.Value = value;
    }

    public readonly Name: string;
    public readonly Description: string;
    public readonly Category: string;
    public readonly Hidden: boolean;
    public Type: UserMediaSettingType = UserMediaSettingType.Generic;
    public Value: T;
}

export class UserMediaSettingsRange extends UserMediaSetting<number> {
    constructor(min: number, max: number, step: number, value: number, name: string, description: string, category: string, hidden: boolean) {
        super(value, name, description, category, hidden);
        this.Min = min;
        this.Max = max;
        this.Step = step;
        this.Type = UserMediaSettingType.Range;
    }

    public readonly Min: number;
    public readonly Max: number;
    public readonly Step: number;
}

export class UserSettingsSelection<T> extends UserMediaSetting<T> {
    constructor(value: T, options: T[], name: string, description: string, category: string, hidden: boolean) {
        super(value, name, description, category, hidden);
        this.Options = options;
        this.Type = UserMediaSettingType.Select;
    }

    public readonly Options: T[] = [];
}

export interface IUserMediaSettings {
    [key: string]: any;
    VideoEnabled: UserMediaSetting<boolean>;
    VideoResolution: UserSettingsSelection<string>;
    VideoFrameRate: UserMediaSettingsRange;

    AudioEnabled: UserMediaSetting<boolean>;
    AudioLocalMeter: UserMediaSetting<boolean>;
    AudioGain: UserMediaSettingsRange;
    AudioLocalListen: UserMediaSetting<boolean>;
    AudioEchoCancellation: UserMediaSetting<boolean>;
    AudioAutoGainControl: UserMediaSetting<boolean>;
    AudioNoiseSuppression: UserMediaSetting<boolean>;
    AudioStereo: UserMediaSetting<boolean>;

    AudioCompressor: UserMediaSetting<boolean>;
    AudioCompressorThreshold: UserMediaSettingsRange;
    AudioCompressorKnee: UserMediaSettingsRange;
    AudioCompressorRatio: UserMediaSettingsRange;
    AudioCompressorAttack: UserMediaSettingsRange;
    AudioCompressorRelease: UserMediaSettingsRange;
}

class UserMediaSettings implements IUserMediaSettings {
    public VideoEnabled: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Video", "Start sending your camera", "Basic Video", false);
    public VideoResolution: UserSettingsSelection<string> = new UserSettingsSelection<string>("720p", ["480p", "720p", "1080p"], "Resolution", "Sets the ideal resolution for your camera. Your web browser might choose to ignore this.", "Advanced Video", false);
    public VideoFrameRate: UserMediaSettingsRange = new UserMediaSettingsRange(15, 60, 5, 20, "Frame Rate", "Sets the ideal frame rate for your camera. Your web browser might choose to ignore this.", "Advanced Video", false);

    public AudioEnabled: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(true, "Enable Audio", null, "Basic Audio", false);
    public AudioLocalMeter: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Audio Meter", null, "Basic Audio", false);
    public AudioGain: UserMediaSettingsRange = new UserMediaSettingsRange(1, 20, 0.5, 1, "Local Gain Multiplier", "The amount of amplification to add to your microphone", "Basic Audio", false);
    public AudioLocalListen: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Local Listen", "Allow you to hear your own microphone, as the other attendees will hear it", "Advanced Audio", false);
    public AudioEchoCancellation: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Echo Cancellation", "If you're using speakers, this will stop the other attendees from hearing themselves", "Advanced Audio", false);
    public AudioAutoGainControl: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Auto Gain", "Enable automatic volume control", "Advanced Audio", false);
    public AudioNoiseSuppression: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Noise Suppression", "Try to filter out background sounds", "Advanced Audio", false);
    public AudioStereo: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Stereo (Firefox attendees only)", null, "Advanced Audio", false);

    public AudioCompressor: UserMediaSetting<boolean> = new UserMediaSetting<boolean>(false, "Enable Dynamics Compressor", "Lowers the volume of the loudest parts of the signal in order to help prevent clipping and distortion", "Advanced Audio", false);
    // https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode/threshold
    public AudioCompressorThreshold: UserMediaSettingsRange = new UserMediaSettingsRange(-100, 0, 1, -24, "Compressor Threshold", "The decibel value above which the compression will start taking effect", "Advanced Audio", true);
    // https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode/knee
    public AudioCompressorKnee: UserMediaSettingsRange = new UserMediaSettingsRange(0, 40, 1, 30, "Compressor Knee", "The decibel value representing the range above the threshold where the curve smoothly transitions to the compressed portion", "Advanced Audio", true);
    // https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode/ratio
    public AudioCompressorRatio: UserMediaSettingsRange = new UserMediaSettingsRange(1, 20, 1, 12, "Compressor Ratio", "The amount of change, in dB, needed in the input for a 1 dB change in the output", "Advanced Audio", true);
    // https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode/attack
    public AudioCompressorAttack: UserMediaSettingsRange = new UserMediaSettingsRange(0, 1, 0.001, 0.003, "Compressor Attack", "The amount of time, in seconds, required to reduce the gain by 10 dB", "Advanced Audio", true);
    // https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode/release
    public AudioCompressorRelease: UserMediaSettingsRange = new UserMediaSettingsRange(0, 1, 0.001, 0.25, "Compressor Release", "The amount of time, in seconds, required to increase the gain by 10 dB", "Advanced Audio", true);
}

interface OnMediaStreamAvailable {
    (stream: MediaStream): void;
}

export class UserMedia implements IUserMedia {
    private audioContext: AudioContext;
    private gainNode: GainNode;
    private analyserNode: AnalyserNode;
    private compressorNode: DynamicsCompressorNode;
    private localListenElement: HTMLAudioElement;
    private currentStream: MediaStream;
    private inputAudioChannels: number;

    private currentSettings: IUserMediaSettings = new UserMediaSettings();

    public OnMediaStreamAvailable: OnMediaStreamAvailable;

    public GetSettings(): IUserMediaSettings {
        return JSON.parse(JSON.stringify(this.currentSettings));
    }

    public async SetSettings(newSettings: IUserMediaSettings): Promise<void> {
        let shouldRefreshMediaAccess: boolean;
        let shouldRefreshLocalListen: boolean;

        if (this.currentSettings.AudioAutoGainControl.Value !== newSettings.AudioAutoGainControl.Value) {
            shouldRefreshMediaAccess = true;
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.AudioEchoCancellation.Value !== newSettings.AudioEchoCancellation.Value) {
            shouldRefreshMediaAccess = true;
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.AudioNoiseSuppression.Value !== newSettings.AudioNoiseSuppression.Value) {
            shouldRefreshMediaAccess = true;
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.AudioLocalMeter.Value !== newSettings.AudioLocalMeter.Value) {
            shouldRefreshMediaAccess = true;
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.VideoEnabled.Value !== newSettings.VideoEnabled.Value) {
            shouldRefreshMediaAccess = true;
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.VideoResolution.Value !== newSettings.VideoResolution.Value) {
            shouldRefreshMediaAccess = true;
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.VideoFrameRate.Value !== newSettings.VideoFrameRate.Value) {
            shouldRefreshMediaAccess = true;
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.AudioLocalListen.Value !== newSettings.AudioLocalListen.Value) {
            shouldRefreshLocalListen = true;
        }

        if (this.currentSettings.AudioStereo.Value !== newSettings.AudioStereo.Value) {
            shouldRefreshLocalListen = true;
            shouldRefreshMediaAccess = true;
        }

        if (this.currentSettings.AudioCompressor.Value !== newSettings.AudioCompressor.Value) {
            shouldRefreshLocalListen = true;
            shouldRefreshMediaAccess = true;
        }

        // These are cheap so don't need to be switched on/off
        this.SetCompressionParameters(newSettings);
        this.SetGainParameters(newSettings);

        this.currentSettings = newSettings;

        // If we should refresh media access, and there is currently a stream to refresh
        if (shouldRefreshMediaAccess && this.currentStream != null) {
            await this.GetMediaStream();
        }

        if (shouldRefreshLocalListen) {
            this.EvaluateLocalListen();
        }
    }

    private EvaluateLocalListen(): void {
        if (this.localListenElement == null) {
            this.localListenElement = document.createElement("audio");
        }

        if (this.currentSettings.AudioLocalListen.Value) {
            this.localListenElement.srcObject = this.currentStream;
            this.localListenElement.play();
        }
        else {
            this.localListenElement.pause();
        }
    }

    public async GetMediaStream(): Promise<MediaStream> {
        const audioConstraints: MediaTrackConstraints = {};
        audioConstraints.noiseSuppression = this.currentSettings.AudioNoiseSuppression.Value;
        audioConstraints.echoCancellation = this.currentSettings.AudioEchoCancellation.Value;
        audioConstraints.autoGainControl = this.currentSettings.AudioAutoGainControl.Value;

        const videoResolutions: { [fromId: string]: number[]; } = {
            '480p': [854, 480],
            '720p': [1280, 720],
            '1080p': [1920, 1080]
        };

        const videoWidthRange: ConstrainULongRange = {};
        videoWidthRange.ideal = videoResolutions[this.currentSettings.VideoResolution.Value][0];

        const videoHeightRange: ConstrainULongRange = {};
        videoHeightRange.ideal = videoResolutions[this.currentSettings.VideoResolution.Value][1];

        const videoFrameRate: ConstrainDouble = {};
        videoFrameRate.ideal = this.currentSettings.VideoFrameRate.Value;

        const videoConstraints: MediaTrackConstraints = {};
        videoConstraints.width = videoWidthRange;
        videoConstraints.height = videoHeightRange;
        videoConstraints.frameRate = videoFrameRate;

        const constraints: MediaStreamConstraints = {};
        constraints.audio = audioConstraints;
        if (this.currentSettings.VideoEnabled.Value) {
            constraints.video = videoConstraints;
        }

        const stream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Lazy initialise the audio context
        if (this.audioContext == null) {
            this.audioContext = new AudioContext();
        }

        const audioTracks: MediaStreamTrack[] = stream.getAudioTracks();
        console.assert(audioTracks.length == 1, "Expected 1 audio track, there are " + audioTracks.length);

        const videoTracks: MediaStreamTrack[] = stream.getVideoTracks();
        console.assert(videoTracks.length <= 1, "Expected 1 or 0 video tracks, there are " + videoTracks.length);

        var combined = this.ProcessAudioTrackToMono(stream);

        if (videoTracks.length > 0) {
            combined.addTrack(videoTracks[0]);
        }

        this.currentStream = combined;

        if (this.OnMediaStreamAvailable != null) {
            this.OnMediaStreamAvailable(this.currentStream);
        }

        return this.currentStream;
    }

    public SampleInput(): number {
        if (this.analyserNode == null) {
            return 0;
        }

        const sampleBuffer = new Float32Array(this.analyserNode.fftSize);

        this.analyserNode.getFloatTimeDomainData(sampleBuffer);

        var peak = 0;
        sampleBuffer.forEach(function (value) {
            peak = Math.max(peak, Math.abs(value));
        });
        return peak;
    }

    private SetGainParameters(newSettings: UserMediaSettings): void {
        if (this.gainNode == null) {
            return;
        }

        if (!newSettings.AudioEnabled.Value) {
            this.gainNode.gain.value = 0;
            return;
        }

        // In Chrome and Firefox, if a user has multiple channels
        // the gain needs to be multiplied by each. For example,
        // with 2 channels, the overall volume maxes out at 50%.
        // I'm not sure whether this is a browser bug or expected.
        this.gainNode.gain.value = this.inputAudioChannels * newSettings.AudioGain.Value;
    }

    private SetCompressionParameters(newSettings: UserMediaSettings): void {
        if (this.compressorNode == null) {
            return;
        }

        this.compressorNode.threshold.value = newSettings.AudioCompressorThreshold.Value;
        this.compressorNode.knee.value = newSettings.AudioCompressorKnee.Value;
        this.compressorNode.ratio.value = newSettings.AudioCompressorRatio.Value;
        this.compressorNode.attack.value = newSettings.AudioCompressorAttack.Value;
        this.compressorNode.release.value = newSettings.AudioCompressorRelease.Value;
    }

    private ProcessAudioTrackToMono(stream: MediaStream): MediaStream {
        const source: MediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(stream);
        this.inputAudioChannels = source.channelCount;

        const destination: MediaStreamAudioDestinationNode = this.audioContext.createMediaStreamDestination();
        destination.channelCount = this.currentSettings.AudioStereo.Value ? 2 : 1;

        this.gainNode = this.audioContext.createGain();
        this.SetGainParameters(this.currentSettings);

        source.connect(this.gainNode);

        let lastNode: AudioNode = this.gainNode;

        if (this.currentSettings.AudioCompressor.Value) {
            this.compressorNode = this.audioContext.createDynamicsCompressor();
            this.SetCompressionParameters(this.currentSettings);
            lastNode.connect(this.compressorNode);
            lastNode = this.compressorNode;
        }
        else {
            this.compressorNode = null;
        }

        if (this.currentSettings.AudioLocalMeter.Value) {
            this.analyserNode = this.audioContext.createAnalyser();
            lastNode.connect(this.analyserNode);
        }
        else {
            this.analyserNode = null;
        }

        lastNode.connect(destination);

        return destination.stream;
    }
}