const { OPCUAServer, Variant, DataType, StatusCodes } = require("node-opcua");

class OpcServer {
    constructor() {
        this.adcValue = 0; // inicializamos el valor
        this.server = new OPCUAServer({
            port: 4334,
            resourcePath: "/Plc/PlcOpcServer",
            hostname: "10.233.106.180",
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
