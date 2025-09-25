const { OPCUAClient, AttributeIds, TimestampsToReturn, ClientSubscription, ClientMonitoredItem } = require("node-opcua");

class OpcClient {
    constructor() {
        this.client = OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: { initialDelay: 1000, maxRetry: 10 },
        });
        this.session = null;
        this.subscription = null;
    }

    async connect(endpointUrl) {
        await this.client.connect(endpointUrl);
        this.session = await this.client.createSession();
        console.log("Cliente OPC UA conectado");

        // Crear suscripción para mantener la conexión viva
        this.subscription = ClientSubscription.create(this.session, {
            requestedPublishingInterval: 500, // ms
            requestedLifetimeCount: 10000,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 10
        });

        this.subscription.on("keepalive", () => console.log("Suscripción Opc Activa"));
        this.subscription.on("terminated", () => console.log("Suscripción terminada"));
    }

    async subscribe(nodeId, callback) {
        if (!this.subscription) return;

        const monitoredItem = ClientMonitoredItem.create(
            this.subscription,
            { nodeId, attributeId: AttributeIds.Value },
            { samplingInterval: 500, discardOldest: true, queueSize: 10 },
            TimestampsToReturn.Both
        );

        monitoredItem.on("changed", (dataValue) => {
            callback(dataValue.value.value);
        });
    }
}

module.exports = OpcClient;
