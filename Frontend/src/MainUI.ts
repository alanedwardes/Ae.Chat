import { ChatApp } from "./ChatApp";
import { IUserMediaSettings, IUserMediaSetting, UserMediaSettingsRange, UserSettingsSelection, UserMediaSettingType, IUserMedia } from "./UserMedia";
import { ConnectionChangeType } from "./PeerConnector";

export class MainUI {
    private readonly chatApp: ChatApp;
    private readonly userMedia: IUserMedia;
    private readonly joinSound: HTMLAudioElement;
    private readonly leaveSound: HTMLAudioElement;
    private remoteVideo: { [id: string]: HTMLDivElement; } = {};

    constructor(chatApp: ChatApp, userMedia: IUserMedia) {
        this.chatApp = chatApp;
        this.userMedia = userMedia;

        this.joinSound = document.createElement("audio");
        this.joinSound.src = "https://s.edward.es/633bc8cc-fc86-4ad1-a1fe-46d815dc4e29.mp3";

        this.leaveSound = document.createElement("audio");
        this.leaveSound.src = "https://s.edward.es/59e427ea-fd86-4642-80a0-6fe6eba887d4.mp3";
    }

    public initialise(): void {
        function hideControls() {
            document.querySelectorAll(".controls, .window").forEach(node => node.classList.add('faded'));
        }

        let timeout = setTimeout(hideControls, 10000);

        function ShowControls(): void {
            clearTimeout(timeout);
            timeout = setTimeout(hideControls, 10000);
            document.querySelectorAll(".controls, .window").forEach(node => node.classList.remove('faded'));
        }

        window.onmousemove = () => ShowControls();
        window.ontouchstart = () => ShowControls();

        this.chatApp.OnMessage = (messageText, messageType) => this.logMessage(messageText, messageType);

        if (window.location.search.startsWith('?')) {
            let settings: IUserMediaSettings = this.userMedia.GetSettings();

            let search = window.location.search.substring(1).split('&');
            for (let i = 0; i < search.length; i++) {
                let parts = search[i].split('=').filter(decodeURIComponent);
                let settingName = parts[0];
                let settingValue = parts[1];

                if (!settings.hasOwnProperty(settingName)) {
                    continue;
                }

                let settingTypedValue;
                try {
                    settingTypedValue = this.parseStringToType(settingValue, typeof (settings[settingName].Value))
                }
                catch (err) {
                    this.logMessage("Unable to parse value for setting " + settingName + ". Please ensure it is of the right type and try again.", "fatal");
                    return;
                }

                settings[settingName].Value = settingTypedValue;
            }

            this.applyNewSettings(settings);
        }

        this.chatApp.OnRemoteStream = (clientId, mediaStream) => {
            let div;
            if (this.remoteVideo.hasOwnProperty(clientId)) {
                div = this.remoteVideo[clientId];
            }
            else {
                div = document.createElement("div");
                div.className = "remoteVideo";
                document.querySelector('#remoteVideo').appendChild(div);

                let video = document.createElement("video");
                div.appendChild(video);
                this.remoteVideo[clientId] = div;
            }

            let video: HTMLVideoElement = <HTMLVideoElement>div.children[0];
            video.srcObject = mediaStream;
            video.play();

            this.flowRemoteVideo();
        }

        this.chatApp.OnLocalStream = (mediaStream) => {
            let video = document.querySelector<HTMLVideoElement>('#localVideo');
            video.srcObject = mediaStream;
            video.play();
        }

        let selfNode = document.createElement("li");
        selfNode.innerHTML = 'You';
        document.querySelector("#attendeeList").appendChild(selfNode);

        this.chatApp.OnLocation = (clientId, location) => {
            let clientNode = this.getClientNode(clientId);
            let labelNode = clientNode.querySelector('span.label');
            let locationNode: HTMLSpanElement = labelNode.querySelector('span.location');

            const shortLocation: string = location.CityName ? location.CityName + " " + location.CountryCode : location.CountryCode;

            if (locationNode === null) {
                locationNode = document.createElement("span");
                locationNode.title = location.SubdivisionName + ", " + location.CityName + ", " + location.CountryName + ", " + location.ContinentName;

                let flag = document.createElement("img");
                flag.src = "https://chat.alanedwardes.com/flags/" + location.CountryCode.toLowerCase() + ".png";
                flag.title = locationNode.title;
                flag.alt = flag.title;
                locationNode.appendChild(flag);

                locationNode.classList.add("location");
                labelNode.appendChild(locationNode);
            }

            let nameNode = labelNode.querySelector('span.name');
            nameNode.innerHTML = shortLocation;
        };

        this.chatApp.OnConnectionChanged = (clientId, change) => {
            let clientNode = this.getClientNode(clientId);

            let statusNode: HTMLSpanElement = clientNode.querySelector('span[data-status-type="' + change.Type.toString() + '"]');
            if (statusNode === null) {
                statusNode = document.createElement("span");
                statusNode.classList.add("status");
                statusNode.innerHTML = "pending";

                switch (change.Type) {
                    case ConnectionChangeType.Ice:
                        statusNode.classList.add("ice");
                        break;
                    case ConnectionChangeType.Signal:
                        statusNode.classList.add("signal");
                        break;
                    case ConnectionChangeType.RTC:
                        statusNode.classList.add("rtc");
                        break;
                }

                statusNode.setAttribute("data-status-type", change.Type.toString());
                clientNode.appendChild(statusNode);
            }

            statusNode.innerHTML = change.State;
        }

        this.chatApp.Start();

        let lastCategory;
        let settings: IUserMediaSettings = this.userMedia.GetSettings();
        for (let key in settings) {
            if (settings.hasOwnProperty(key)) {
                if (settings[key].Hidden) {
                    continue;
                }

                let parentElement: HTMLElement;
                if (key.startsWith("Audio")) {
                    parentElement = document.querySelector('#audioParameters');
                }
                if (key.startsWith("Video")) {
                    parentElement = document.querySelector('#videoParameters');
                }
                if (key.startsWith("Screen")) {
                    parentElement = document.querySelector('#screenParameters');
                }

                if (lastCategory != settings[key].Category) {
                    this.createCategoryTitle(settings[key].Category, parentElement);
                }

                lastCategory = settings[key].Category;
                this.createSetting(key, settings[key], parentElement);
            }
        }

        document.querySelector('#audioControlsButton').addEventListener('click', () => {
            document.querySelector('#audioControls').classList.remove("hidden");
        });

        document.querySelector('#videoControlsButton').addEventListener('click', () => {
            document.querySelector('#videoControls').classList.remove("hidden");
        });

        document.querySelector('#screenControlsButton').addEventListener('click', () => {
            document.querySelector('#screenControls').classList.remove("hidden");
        });

        document.querySelector('#attendeeWindowButton').addEventListener('click', () => {
            document.querySelector('#attendeeWindow').classList.remove("hidden");
        });

        document.querySelectorAll('.closeButton').forEach(element => {
            element.addEventListener('click', event => {
                let sourceElement = <HTMLButtonElement>event.srcElement;
                sourceElement.parentElement.classList.add("hidden");
            });
        });
    }

    public countryCodeEmoji(country: string): string {
        const offset = 127397;
        const f = country.codePointAt(0);
        const s = country.codePointAt(1);

        return String.fromCodePoint(f + offset) + String.fromCodePoint(s + offset);
    }

    public getClientNode(clientId: string): HTMLLIElement {
        const attendeeList = document.querySelector("#attendeeList");

        let clientNode: HTMLLIElement = attendeeList.querySelector('li[data-connection-id="' + clientId + '"]');
        if (clientNode === null) {
            clientNode = document.createElement("li");
            clientNode.setAttribute("data-connection-id", clientId);

            let labelNode = document.createElement("span");
            labelNode.className = "label";
            clientNode.appendChild(labelNode);

            let nameNode = document.createElement("span");
            nameNode.innerHTML = clientId.substring(0, 6);
            nameNode.className = "name";
            labelNode.appendChild(nameNode);

            attendeeList.appendChild(clientNode);

            this.joinSound.play();
            this.logMessage("Someone connected!", "info");
        }

        return clientNode;
    }

    public logMessage(messageText: string, messageType: string) {
        let timeoutHandle: number;
        if (messageType != "fatal") {
            timeoutHandle = setTimeout(() => {
                list.removeChild(container);
            }, 10000);
        }

        let list = document.querySelector(".messages");

        let container = document.createElement("div");
        container.className = messageType + "Message message";

        let closeButton = document.createElement("button");
        closeButton.className = "closeButton";
        closeButton.innerHTML = "✕";
        closeButton.onclick = () => {
            clearTimeout(timeoutHandle);
            list.removeChild(container);
        }
        container.appendChild(closeButton);

        let message = document.createElement("span");
        message.innerHTML = messageText;
        container.appendChild(message);

        list.appendChild(container);
    }

    public flowRemoteVideo() {
        let videos = Array.prototype.slice.call(document.querySelectorAll('.remoteVideo'));
        let videoCount = videos.length;
        //let rowCount = Math.ceil(videoCount / 2);
        let columnCount = Math.ceil(videoCount / 2);

        let currentColumn = 0;
        let currentRow = 0;

        while (videos.length > 0) {
            let video = videos.pop();

            video.style['grid-area'] = (currentRow + 1) + " / " + (currentColumn + 1) + " / span 1 / span 1";

            currentColumn++;
            if (currentColumn > columnCount - 1) {
                currentColumn = 0;
                currentRow++;
            }
        }
    }

    public createCategoryTitle(category: string, parent: HTMLElement) {
        let title = document.createElement('h2');
        title.innerHTML = category;
        parent.appendChild(title);
    }

    public applyNewSettings(newSettings: IUserMediaSettings) {
        this.userMedia.SetSettings(newSettings);

        this.shouldDrawMeter = newSettings.AudioLocalMeter.Value;
        this.drawAudioMeter();
    }

    public createSetting(settingKey: string, settingValue: IUserMediaSetting, parent: HTMLElement) {
        let paragraph = document.createElement("p");
        parent.appendChild(paragraph);
        if (settingValue.Description != null) {
            paragraph.setAttribute("title", settingValue.Description);
        }

        if (settingValue.Type == UserMediaSettingType.Generic) {
            let input = document.createElement("input");
            paragraph.appendChild(input);

            input.type = "checkbox";
            input.id = "setting" + input.type + settingKey;
            input.checked = settingValue.Value;
            input.oninput = (event) => {
                let settings: IUserMediaSettings = this.userMedia.GetSettings();
                let sourceElement: HTMLInputElement = <HTMLInputElement>event.srcElement;
                settings[settingKey].Value = sourceElement.checked;
                this.applyNewSettings(settings);
            };

            let label = document.createElement("label");
            label.innerHTML = settingValue.Name;
            if (settingValue.Description != null) {
                label.classList.add("helptext");
            }
            label.setAttribute("for", input.id);
            paragraph.append(label);
        }
        else if (settingValue.Type == UserMediaSettingType.Range) {
            let settingValueRange = <UserMediaSettingsRange>settingValue;

            let label = document.createElement("span");
            label.innerHTML = settingValue.Name;
            if (settingValue.Description != null) {
                label.classList.add("helptext");
            }
            paragraph.appendChild(label);

            let valueLabel = document.createElement("span");
            valueLabel.innerHTML = settingValue.Value;

            let br = document.createElement("br");
            paragraph.appendChild(br);

            let input = document.createElement("input");
            paragraph.appendChild(input);

            input.type = "range";
            input.step = settingValueRange.Step.toString();
            input.min = settingValueRange.Min.toString();
            input.max = settingValueRange.Max.toString();
            input.value = settingValue.Value;
            input.oninput = (event) => {
                let sourceElement = <HTMLInputElement>event.srcElement;
                valueLabel.innerHTML = sourceElement.value;
            };

            input.onchange = (event) => {
                let settings: IUserMediaSettings = this.userMedia.GetSettings();
                let sourceElement = <HTMLInputElement>event.srcElement;
                settings[settingKey].Value = sourceElement.value;
                this.applyNewSettings(settings);
            };

            paragraph.appendChild(valueLabel);
        }
        else if (settingValue.Type == UserMediaSettingType.Select) {
            let settingValueOptions = <UserSettingsSelection<any>>settingValue;

            let label = document.createElement("label");
            label.innerHTML = settingValue.Name;
            if (settingValue.Description != null) {
                label.classList.add("helptext");
            }
            paragraph.append(label);

            let select = document.createElement("select");
            paragraph.appendChild(select);

            for (let i = 0; i < settingValueOptions.Options.length; i++) {
                let option = document.createElement("option");
                option.value = settingValueOptions.Options[i];
                option.innerHTML = option.value;
                select.appendChild(option);
            }

            select.selectedIndex = settingValueOptions.Options.indexOf(settingValue.Value);

            select.id = "setting" + select.type + settingKey;
            select.oninput = (event) => {
                let settings: IUserMediaSettings = this.userMedia.GetSettings();
                let sourceElement = <HTMLSelectElement>event.srcElement;
                settings[settingKey].Value = settings[settingKey].Options[sourceElement.selectedIndex];
                this.applyNewSettings(settings);
            };

            label.setAttribute("for", select.id);
        }
    }

    private shouldDrawMeter: boolean = false;
    public drawAudioMeter() {
        let canvas = <HTMLCanvasElement>document.getElementById("volumeCanvas");

        if (!this.shouldDrawMeter) {
            canvas.width = 0;
            canvas.height = 0;
            return;
        }

        let context = canvas.getContext("2d");

        let sample = this.userMedia.SampleInput();

        if (canvas.width != document.body.clientWidth) {
            canvas.width = document.body.clientWidth;
            canvas.height = 5;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = "green";

        if (sample >= .85) {
            context.fillStyle = "orange";
        }

        if (sample >= .99) {
            context.fillStyle = "red";
        }

        context.fillRect(0, 0, canvas.width * sample, 64);

        window.requestAnimationFrame(() => this.drawAudioMeter());
    }

    public parseStringToType(input: string, type: string) {
        if (type === "boolean") {
            if (input.toLowerCase() === "true") {
                return true;
            }

            if (input.toLowerCase() === "false") {
                return false;
            }
        }

        if (type === "number") {
            let value = parseFloat(input);
            if (!isNaN(value)) {
                return value;
            }
        }

        throw "Error parsing " + input + " to " + type;
    }
}