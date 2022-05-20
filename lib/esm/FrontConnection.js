import { EventType } from "./types";
var isOriginalTitle = false;
var originalTitle = '';
export var createFrontConnection = function (options) {
    var messageListener = function (event) {
        switch (event.data.type) {
            case EventType.AccessToken: {
                var payload = { accessToken: event.data.payload };
                (options === null || options === void 0 ? void 0 : options.onBrokerConnected) && options.onBrokerConnected(payload);
                break;
            }
            case EventType.DelayedAuth: {
                var payload = { delayedAuth: event.data.payload };
                (options === null || options === void 0 ? void 0 : options.onBrokerConnected) && options.onBrokerConnected(payload);
                break;
            }
            case EventType.SetTitle: {
                var data = event.data;
                if (isOriginalTitle) {
                    originalTitle = document.title;
                    isOriginalTitle = false;
                }
                document.title = data.hideTitle ? 'Front' : "Front - " + data.title;
                break;
            }
            case EventType.Loaded: {
                break;
            }
            case EventType.Exit:
            case EventType.Done: {
                (options === null || options === void 0 ? void 0 : options.onExit) && options.onExit(event.data.message);
                dispose();
                break;
            }
        }
    };
    var open = function () {
        dispose(); // remove instance if already open
        if (options.authLink == "") {
            (options === null || options === void 0 ? void 0 : options.onExit) && options.onExit("Invalid link!");
            return;
        }
        window.parent.addEventListener('message', messageListener);
        var iframe = document.createElement('iframe');
        iframe.id = 'front-link';
        iframe.title = 'front-link';
        iframe.style.position = 'absolute';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.padding = '0';
        iframe.style.margin = '0';
        iframe.style.top = '0';
        iframe.style.border = '0';
        iframe.src = options.authLink;
        document.body.appendChild(iframe);
        var container = document.createElement('div');
        container.id = 'front-link-close';
        container.style.position = 'absolute';
        container.style.display = 'flex';
        container.style.justifyContent = 'end';
        container.style.alignItems = 'center';
        container.style.width = '100%';
        container.style.height = '20px';
        container.style.padding = '0';
        container.style.margin = '0';
        container.style.top = '20px';
        document.body.appendChild(container);
        var divButton = document.createElement('div');
        divButton.id = 'front-link-close-button';
        divButton.style.position = 'relative';
        divButton.style.width = '24px';
        divButton.style.height = '24px';
        divButton.style.paddingRight = '20px';
        divButton.innerHTML = "\n      <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#272836\"/>\n      <path d=\"M14.3719 8.28152C14.744 7.90942 15.3473 7.90942 15.7195 8.28152C16.0577 8.6198 16.0885 9.14915 15.8117 9.52216L15.7195 9.62903L9.63147 15.717C9.25937 16.0891 8.65607 16.0891 8.28396 15.717C7.94568 15.3787 7.91493 14.8494 8.1917 14.4764L8.28396 14.3695L14.3719 8.28152Z\" fill=\"white\"/>\n      <path d=\"M8.27915 8.27901C8.61746 7.94077 9.14681 7.91007 9.5198 8.18688L9.62666 8.27915L15.7197 14.3735C16.0918 14.7456 16.0917 15.3489 15.7196 15.721C15.3813 16.0592 14.8519 16.0899 14.4789 15.8131L14.3721 15.7209L8.27901 9.62652C7.90694 9.25438 7.90701 8.65107 8.27915 8.27901Z\" fill=\"white\"/>\n      </svg>\n    ";
        divButton.onclick = function () {
            (options === null || options === void 0 ? void 0 : options.onExit) && options.onExit();
            dispose();
        };
        container.appendChild(divButton);
    };
    var dispose = function () {
        window.removeEventListener('message', messageListener);
        var element1 = document.getElementById('front-link');
        var element2 = document.getElementById('front-link-close');
        var element3 = document.getElementById('front-link-close-button');
        element1 === null || element1 === void 0 ? void 0 : element1.remove();
        element2 === null || element2 === void 0 ? void 0 : element2.remove();
        element3 === null || element3 === void 0 ? void 0 : element3.remove();
        if (!isOriginalTitle) {
            document.title = originalTitle;
            isOriginalTitle = true;
        }
    };
    return {
        dispose: dispose,
        open: open
    };
};
