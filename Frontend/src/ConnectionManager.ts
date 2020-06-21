import { IBroker, Envelope } from "./Broker";
import { IPeerConnector, ConnectionChange } from "./PeerConnector";
import { ISessionConfig } from "./SessionConfig";
import { IPeerConnectorFactory } from "./PeerConnectorFactory";

interface OnHasStreamsDelegate {
    (fromId: string, streams: readonly MediaStream[]): void;
}

interface OnNeedLocalStreamDelegate {
    (): MediaStream;
}

interface OnClientConnectionChangedDelegate {
    (clientId: string, change: ConnectionChange): void;
}

export class ClientLocation {
    CityName: string;
    CountryName: string;
    CountryCode: string;
    ContinentName: string;
    SubdivisionName: string;
}

interface OnClientLocationDelegate {
    (clientId: string, location: ClientLocation): void;
}

export class ConnectionManager {
    private readonly broker: IBroker;
    public OnHasStreams: OnHasStreamsDelegate;
    public OnNeedLocalStream: OnNeedLocalStreamDelegate;
    public OnConnectionChanged: OnClientConnectionChangedDelegate;
    public OnLocation: OnClientLocationDelegate;

    private connectors: { [fromId: string]: IPeerConnector; } = {};
    private readonly sessionConfig: ISessionConfig;
    private readonly peerConnectorFactory: IPeerConnectorFactory;

    constructor(broker: IBroker, sessionConfig: ISessionConfig, peerConnectorFactory: IPeerConnectorFactory) {
        this.broker = broker;
        this.sessionConfig = sessionConfig;
        this.peerConnectorFactory = peerConnectorFactory;
        this.broker.OnMessage = (message: Envelope) => this.OnMessage(message);
    }

    public RefreshLocalStream() {
        const localStream: MediaStream = this.OnNeedLocalStream();

        for (let clientId in this.connectors) {
            if (this.connectors.hasOwnProperty(clientId)) {
                this.connectors[clientId].StartLocalStream(localStream);
            }
        }
    }

    private CreateConnector(fromId: string): void {
        if (this.connectors.hasOwnProperty(fromId)) {
            return;
        }

        const shouldOffer: boolean = fromId < this.sessionConfig.AttendeeId;

        const peerConnector = this.peerConnectorFactory.CreatePeerConnector(shouldOffer);
        console.log("Creating peer connector for " + fromId + " (shouldOffer: " + shouldOffer + ")");

        peerConnector.OnConnectionChanged = change => {
            this.OnConnectionChanged(fromId, change);
            
            // If any change type is failed, clean up
            if (change.State == "failed") {
                console.warn("Deleting connector from " + fromId);
                this.connectors[fromId].Shutdown();
                delete this.connectors[fromId];
            }
        };

        peerConnector.OnHasIceCandidates = candidates => {
            this.broker.Send(candidates, "candidates", fromId);
        }

        peerConnector.OnHasStreams = streams => {
            this.OnHasStreams(fromId, streams);
        };

        peerConnector.OnHasOffer = offer => {
            this.broker.Send(offer, "offer", fromId);
        }

        peerConnector.OnAcceptedOffer = offer => {
            this.broker.Send(offer, "accept", fromId);
        };

        peerConnector.StartLocalStream(this.OnNeedLocalStream());
        this.connectors[fromId] = peerConnector;
    }

    private OnMessage(message: Envelope) {
        if (message.FromId == this.sessionConfig.AttendeeId) {
            return;
        }

        this.CreateConnector(message.FromId);

        if (message.Type == "offer") {
            this.connectors[message.FromId].AcceptOffer(message.Data);
        }
        if (message.Type == "accept") {
            this.connectors[message.FromId].AcceptAnswer(message.Data);
        }
        if (message.Type == "candidates") {
            this.connectors[message.FromId].AddRemoteCandidates(message.Data);
        }
        if (message.Type == "location") {
            let location: ClientLocation = new ClientLocation();
            location.CityName = message.Data["cityName"];
            location.CountryName = message.Data["countryName"];
            location.CountryCode = message.Data["countryCode"];
            location.ContinentName = message.Data["continentName"];
            location.SubdivisionName = message.Data["subdivisionName"];
            this.OnLocation(message.FromId, location);
        }
        if (message.Type == "discover") {
            this.broker.Send({}, "acknowledge", message.FromId);
        }
    }
}