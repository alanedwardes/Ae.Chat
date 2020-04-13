class Size {
    public Width: number;
    public Height: number;
}

class VideoStream {
    constructor(mediaStream: MediaStream, muted: boolean) {
        this.Stream = mediaStream;
        this.Track = mediaStream.getVideoTracks()[0];
        this.Settings = this.Track.getSettings();
        this.Element = document.createElement("video");
        this.Element.srcObject = mediaStream;
        this.Element.muted = muted;
        this.Element.play();
        this.Size = new Size();
        this.Size.Width = this.Settings.width;
        this.Size.Height = this.Settings.height;
    }

    public readonly Element: HTMLVideoElement;
    public readonly Stream: MediaStream;
    public readonly Track: MediaStreamTrack;
    public readonly Settings: MediaTrackSettings;
    public readonly Size: Size;
}

export class VideoWall {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private localStream: VideoStream;

    private readonly remoteStreams: Array<VideoStream> = new Array<VideoStream>();

    constructor() {
        this.canvas = document.getElementById('videoWall') as HTMLCanvasElement;
        this.context = this.canvas.getContext("2d");
        this.Render();
    }

    public SetLocalStream(mediaStream: MediaStream) {
        this.localStream = new VideoStream(mediaStream, true);
    }

    public AddRemoteStream(mediaStream: MediaStream) {
        if (this.remoteStreams.filter(stream => stream.Stream.id == mediaStream.id).length > 0) {
            console.warn("Ignoring duplicate remote stream with ID " + mediaStream.id);
            return;
        }

        if (mediaStream == this.localStream.Stream) {
            console.error("Ignoring remote media stream as it is the same as the local stream");
            return;
        }

        const newStream: VideoStream = new VideoStream(mediaStream, false);
        this.remoteStreams.push(newStream);
    }

    private CalculateAspectRatioFit(srcWidth: number, srcHeight: number, maxWidth: number, maxHeight: number): Size {
        const ratio: number = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
        const size = new Size();
        size.Width = srcWidth * ratio;
        size.Height = srcHeight * ratio;
        return size;
    }

    private Render() {
        // Resize the canvas
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        if (this.remoteStreams.length > 0) {
            this.DrawRemoteStreams();
        }

        if (this.localStream != null) {
            this.DrawLocalStream();
        }

        window.requestAnimationFrame(() => this.Render());
    }

    private DrawLocalStream() {
        // Calculate the local video size
        const localVideoSize: Size = this.CalculateAspectRatioFit(
            this.localStream.Size.Width,
            this.localStream.Size.Height,
            this.canvas.width / 5,
            this.canvas.height / 5);

        // Draw the local video
        this.context.drawImage(
            this.localStream.Element,
            this.canvas.width - localVideoSize.Width - (this.canvas.width / 30),
            this.canvas.height - localVideoSize.Height - (this.canvas.height / 30),
            localVideoSize.Width,
            localVideoSize.Height);
    }

    private RemoveInactiveRemoteStreams(): void {
        const inactiveStreams: VideoStream[] = this.remoteStreams.filter((stream: VideoStream) => !stream.Stream.active);
        if (inactiveStreams.length > 0) {
            inactiveStreams.forEach((stream: VideoStream) => {
                const index: number = this.remoteStreams.indexOf(stream);
                this.remoteStreams.splice(index, 1);
            });
        }
    }

    private DrawRemoteStreams(): void {
        this.RemoveInactiveRemoteStreams();

        if (this.remoteStreams.length == 1) {

            const videoStream: VideoStream = this.remoteStreams[0];

            const videoSize: Size = this.CalculateAspectRatioFit(
                videoStream.Size.Width * 10,
                videoStream.Size.Height * 10,
                this.canvas.width,
                this.canvas.height);

            this.context.drawImage(this.localStream.Element, 0, 0, this.canvas.width, this.canvas.height);
        }
    }
}