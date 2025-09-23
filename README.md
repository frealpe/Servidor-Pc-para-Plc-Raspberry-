Version 6 1.8 Gb

ssh pi@172.21.61.193

En caso de borrar imagenes de la sd la direccion para descargarlas es https://apps.industrialshields.com/main/rpi/images/RPI_PLC/

0)Por defecto el ususario es pi y el password es raspberry
1)Cambiar contraseña para hacer ssh
2) Interface Gráfica VNC 
3) Instalar paquetes de Shield para poder correr los programas
	*https://www.industrialshields.com/es_ES/slides/first-steps-with-raspberry-pi-13
	*Definir la ip ya sea por comando o por interface gráfica "sudo raspi-config"
	*Ver la versión de mi PLC cat /proc/device-tree/model
/**********************************************************************RUTINAS EN C**********************************************************************/
	*Instalar la libreria de librpiplc "Son las librerias de c para manejar los pines estan mapeadas en c" https://github.com/Industrial-Shields/librpiplc
		sudo apt update
		sudo apt install git cmake build-essential -y

		# Clonar repositorio
		git clone https://github.com/Industrial-Shields/librpiplc.git
		cd librpiplc

		# Configurar compilación para tu modelo
		cmake -B build/ -DPLC_VERSION=RPIPLC_V6 -DPLC_MODEL=RPIPLC_58

		# Compilar e instalar
		cmake --build build/ -- -j$(nproc)
		sudo cmake --install build/

		# Actualizar caché de librerías
		sudo ldconfig
		
		Correr un programa en c g++ -o Pines Pines.cpp -I/usr/local/include/librpiplc -L/usr/local/lib -lrpiplc
		
/**********************************************************************RUTINAS EN PYTHON**********************************************************************/
1)Debido a que es v6 toca bajar la version de libreiras python de acuerdo a esa version		
	* https://github.com/Industrial-Shields/python3-librpiplc/releases/tag/v4.0.1, Descomprimir 
2) cat /etc/os-release

PRETTY_NAME="Raspberry Pi OS GNU/Linux 11 (bullseye)"
VERSION_CODENAME=bullseye

Si es (bullseyse) sudo python3 -m pip install .

////////////////////////////////////VERSION USADA PARA NUESTRO CASO/////////////////////////////////////////////////////////////////////////////
PRETTY_NAME="Raspberry Pi OS GNU/Linux 12 (bookworm)"
VERSION_CODENAME=bookworm

Si es Raspberry Pi OS Bookworm (o superior): sudo tee /etc/apt/sources.list.d/industrialshields.list > /dev/null <<EOF deb https://apps.industrialshields.com/main/DebRepo/ ./ EOF

wget -O - https://apps.industrialshields.com/main/DebRepo/PublicKey.gpg | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/IndustrialShieldsDebian.gpg > /dev/null

sudo apt update

3) Verifica si esta istalado python3 -m pip show rpiplc-lib
		Name: rpiplc-lib
		Version: 4.0.1
		Summary: Industrial Shields RPIPLC library for python3
		Location: /usr/local/lib/python3.11/dist-packages/
4)corred python3 programa.py

/**********************************************************************MQTT**********************************************************************/
INSTALAR MOSQUITO EN EL PC Y EN EL PLC

sudo apt update
sudo apt install mosquitto mosquitto-clients -y

Iniciar el broker
Para el servicio	sudo systemctl enable mosquitto
Inicia el servicio	sudo systemctl start mosquitto
O simplemente para lanzar el servicio
			mosquitto -v
Para verificar que esta corriendo 
			
			sudo systemctl status mosquitto
			

Permitir conexiones externas
		sudo nano /etc/mosquitto/mosquitto.conf
		allow_anonymous true
		connection_messages true
		log_type all
				
		sudo systemctl restart mosquitto
El comando verifica si el esta corriendo 	
		sudo lsof -i :1883 
Si se quiere otro puerto 
		mosquitto -p 1884 -v

BROKER: Será mi pc

sudo mosquitto_passwd -c /etc/mosquitto/passwd plcuser  Crea un password: plc

sudo mosquitto_passwd /etc/mosquitto/passwd otroUser si quiere otro usuario

crear sudo nano /etc/mosquitto/aclfile
	user plcuser
	topic readwrite Plc/Adc
	topic readwrite Plc/Ia
	topic readwrite Plc/Pwm
	topic readwrite Plc/Timer
	topic readwrite Plc/Setpoint

sudo nano mosquitto.conf 
	# Escucha en todas las interfaces
	listener 1883 0.0.0.0

	# Seguridad
	allow_anonymous false
	password_file /etc/mosquitto/passwd
	acl_file /etc/mosquitto/aclfile

	# Logs
	connection_messages true
	log_type all

sudo systemctl restart mosquitto

sudo systemctl status mosquitto

sudo lsof -i :1883

mosquitto_sub -h localhost -t "Plc/#" -u plcuser -P "plc"


CLIENTE: Será mi Plc

mosquitto_pub -h localhost -t "Plc/Adc" -m "123" -u plcuser -P "plc"
/**********************************************************************RUTINAS C PASADAS A NODE**********************************************************************/
Instalar npm install -g node-gyp
	 npm install node-addon-api

sudo nano binding.gyp
	{
	  "targets": [
	    {
	      "target_name": "rpiplc",
	      "sources": [ "rpiplc_wrapper.cpp" ],
	      "include_dirs": [
		"<!@(node -p \"require('node-addon-api').include\")",
		"/usr/local/include/librpiplc"
	      ],
	      "libraries": [
		"-lrpiplc"
	      ],
	      "cflags": [ "-Wall" ],
	      "cflags_cc": [ "-std=c++17", "-fexceptions" ],
	      "defines": [
		"NAPI_CPP_EXCEPTIONS",
		"RPIPLC_V6",
		"RPIPLC_58"
	      ]
	    }
      
sudo nano rpiplc_wrapper.cpp

#define RPIPLC_V6
#define RPIPLC_58

#include <napi.h>
#include <librpiplc/expanded-gpio.h>
#include <librpiplc/rpiplc.h>
#include "common.h"

// ---------------- Digital ----------------
Napi::Number WriteDigital(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) return Napi::Number::New(env, -1);
    uint32_t pin = info[0].As<Napi::Number>().Uint32Value();
    uint8_t value = info[1].As<Napi::Number>().Uint32Value();
    pinMode(pin, OUTPUT);
    int res = digitalWrite(pin, value);
    return Napi::Number::New(env, res);
}

Napi::Number ReadDigital(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) return Napi::Number::New(env, -1);
    uint32_t pin = info[0].As<Napi::Number>().Uint32Value();
    int res = digitalRead(pin);
    return Napi::Number::New(env, res);
}

// ---------------- ADC / PWM ----------------
Napi::Number ReadADC(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (numAnalogInputs == 0) return Napi::Number::New(env, -1);
    uint16_t value = analogRead(analogInputs[0]);
    return Napi::Number::New(env, value);
}

Napi::Number WritePWM(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (numAnalogOutputs == 0 || info.Length() < 1) return Napi::Number::New(env, -1);
    uint8_t duty = info[0].As<Napi::Number>().Uint32Value();
    analogWrite(analogOutputs[0], duty);
    return Napi::Number::New(env, 0);
}

// ---------------- Init ----------------
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    initExpandedGPIO(false);
    exports.Set("writeDigital", Napi::Function::New(env, WriteDigital));
    exports.Set("readDigital", Napi::Function::New(env, ReadDigital));
    exports.Set("readADC", Napi::Function::New(env, ReadADC));
    exports.Set("writePWM", Napi::Function::New(env, WritePWM));
    return exports;
}

NODE_API_MODULE(rpiplc, Init)



node-gyp clean
node-gyp configure
node-gyp build

Si la compilación sale bien genera una carpeta build
//////////////////////////////////////////EJEMPLO NODE//////////////////////////////////////////
sudo nano prueba.js
const plc = require('./build/Release/rpiplc');

const Q0_0_PIN = 20971532; // Reemplaza por el valor correcto de tu common.h>

console.log("Encendiendo Q0.0...");
plc.writeDigital(Q0_0_PIN, 1);
setTimeout(() => {
    console.log("Apagando Q0.0...");
    plc.writeDigital(Q0_0_PIN, 0);
}, 2000);


node prueba.js
/**********************************************************************OPEN PLC INDUSTRIAL SHIELD**********************************************************************/
Instalar en el Pc para comunicarse con el PLC:
Descargar de el sitio oficial el instalador https://autonomylogic.com/download-linux 
sudo apt update
sudo apt install git python3-pip -y
pip3 install openplc_editor
Ejecutar
openplc_editor

/////////////////////////////////////////////////////////////////////////////////////////////////

En la Raspeberry:
se debe instalar del respositorio 
git clone https://github.com/thiagoralves/OpenPLC_v3.git
cd OpenPLC_v3
./install.sh rpi
sudo systemctl status openplc.service




