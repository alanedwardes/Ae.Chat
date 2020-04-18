import { UserMedia, UserMediaSettings } from "./UserMedia";
import { v4 as uuidv4 } from 'uuid';
import { Broker, IBroker } from "./Broker";
import { VideoWall } from "./VideoWallUI";
import { ConnectionManager } from "./ConnectionManager";

interface OnConnectDelegate {
    (connectionId: string): void;
}

interface OnDisconnectDelegate {
    (connectionId: string): void;
}

export class ChatApp {
    public static NewGuid(): string { return uuidv4(); }

    public static GetAudioLevel(): number { return ChatApp.userMedia.SampleInput(); }

    public static GetMediaSettings(): UserMediaSettings { return ChatApp.userMedia.GetSettings(); }
    public static async SetMediaSettings(newSettings: UserMediaSettings): Promise<void> { await ChatApp.userMedia.SetSettings(newSettings); }

    private static sessionId: string = uuidv4();
    private static fromId: string = uuidv4();
    private static userMedia: UserMedia = new UserMedia();
    private static videoWall: VideoWall;
    private static localStream: MediaStream;
    private static connectionManager: ConnectionManager;

    public static OnConnect: OnConnectDelegate;
    public static OnDisconnect: OnDisconnectDelegate;

    public static GetAttendeeId(): string { return ChatApp.fromId; }

    public static async Start(roomId: string): Promise<void> {
        ChatApp.videoWall = new VideoWall();

        ChatApp.userMedia.OnMediaStreamAvailable = mediaStream => {
            ChatApp.localStream = mediaStream;
            ChatApp.videoWall.SetLocalStream(mediaStream);

            if (ChatApp.connectionManager != null) {
                ChatApp.connectionManager.RefreshLocalStream();
            }
        };

        await ChatApp.userMedia.GetMediaStream();

        const broker: IBroker = new Broker(roomId, this.fromId, this.sessionId);

        this.connectionManager = new ConnectionManager(broker);
        this.connectionManager.OnClientConnect = (clientId) => ChatApp.OnConnect(clientId);
        this.connectionManager.OnClientDisconnect = (clientId) => ChatApp.OnDisconnect(clientId);
        this.connectionManager.OnNeedLocalStream = () => ChatApp.localStream;
        this.connectionManager.OnHasStreams = (clientId, streams) => {
            streams.forEach(stream => {
                ChatApp.videoWall.AddRemoteStream(stream);
            });
        };

        await broker.Open();

        ChatApp.OnConnect(ChatApp.fromId);
    }
}