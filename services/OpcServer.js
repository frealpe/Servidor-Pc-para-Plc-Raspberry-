const { OPCUAServer, Variant, DataType, StatusCodes } = require("node-opcua");

class OpcServer {
    constructor() {
        this.adcValue = 0; // inicializamos el valor
        this.server = new OPCUAServer({
            port: parseInt(process.env.OPC_PORT, 10) || 4334,
            resourcePath: process.env.OPC_PATH || "/Plc/PlcOpcServer",
            hostname: process.env.OPC_HOST || "127.0.0.1",
            buildInfo: {
                productName: "PlcServer",
                buildNumber: "1",
                buildDate: new Date()
            },
        });
    }

    async start() {
        await this.server.initialize();

        const addressSpace = this.server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        namespace.addVariable({
            organizedBy: this.server.engine.addressSpace.rootFolder.objects,
            browseName: "ADC",
            nodeId: "ns=1;s=ADC",
            dataType: "Double",
            minimumSamplingInterval: 100, // cada 100ms
            value: {
                get: () => new Variant({ dataType: DataType.Double, value: this.adcValue }),
                set: (variant) => {
                    this.adcValue = variant.value;
                    return StatusCodes.Good;
                }
            }
        });

        await this.server.start();
        console.log(
            "Servidor OPC UA corriendo en:",
            this.server.endpoints[0].endpointDescriptions()[0].endpointUrl
        );
    }
}

module.exports = OpcServer;
