export interface IBroker {
    Open(): Promise<void>
    Broadcast(payload: any, type: string): void
    OnMessage: OnMessageDelegate;
}

export class Envelope {
    public RoomId: string;
    public Type: string;
    public Data: any;
}

interface OnMessageDelegate {
    (message: Envelope): void;
}

export class Broker implements IBroker {
    private socket: WebSocket;
    private roomId: string;

    public OnMessage: OnMessageDelegate;

    public constructor(roomId: string) {
        this.roomId = roomId;
    }

    public async Open(): Promise<void> {
        this.socket = new WebSocket("wss://c4x3tpp039.execute-api.eu-west-1.amazonaws.com/default");
        this.socket.onmessage = (event : MessageEvent) => this.OnMessageInternal(event);
        return new Promise(resolve => this.socket.onopen = () => resolve());
    }

    private OnMessageInternal(event : MessageEvent): void {
        const data: string = JSON.parse(event.data);
        const envelope: Envelope = new Envelope();
        envelope.Data = JSON.parse(data["data"]);
        envelope.RoomId = data["roomId"];
        envelope.Type = data["type"];
        console.info("Received: " + envelope.Type);
        this.OnMessage(envelope);
    }

    public Broadcast(payload: any, type: string): void {
        const serialized: string = JSON.stringify({
            roomId: this.roomId,
            type: type,
            data: JSON.stringify(payload)
        });
        console.info("Sent: " + type)
        this.socket.send(serialized);
    }
}