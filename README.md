# Configuración y Uso del RPIPLC V6 (1.8 Gb)

Este documento recopila los pasos necesarios para configurar y trabajar con un **Industrial Shields RPIPLC V6** usando **C, Python, Node.js, MQTT y OpenPLC**.

---

## 📡 Conexión inicial

- Usuario por defecto: `pi`  
- Password por defecto: `raspberry`  
- Conexión SSH:  

```bash
ssh pi@172.21.61.193
```

👉 Si se borran las imágenes de la SD, se pueden descargar en:  
[Repositorio de imágenes oficiales](https://apps.industrialshields.com/main/rpi/images/RPI_PLC/)

---

## 🔒 Primeros pasos

1. Cambiar la contraseña para acceso SSH.  
2. Habilitar la **interfaz gráfica VNC**.  
3. Instalar paquetes de Shield para ejecutar programas.  
   - Guía oficial: [First Steps Industrial Shields](https://www.industrialshields.com/es_ES/slides/first-steps-with-raspberry-pi-13)  
4. Definir la IP con:

```bash
sudo raspi-config
```

5. Ver versión de PLC:  

```bash
cat /proc/device-tree/model
```

---

## ⚙️ Rutinas en C

### Instalación de librería `librpiplc`

```bash
sudo apt update
sudo apt install git cmake build-essential -y

git clone https://github.com/Industrial-Shields/librpiplc.git
cd librpiplc

cmake -B build/ -DPLC_VERSION=RPIPLC_V6 -DPLC_MODEL=RPIPLC_58
cmake --build build/ -- -j$(nproc)
sudo cmake --install build/
sudo ldconfig
```

### Compilar un programa en C

```bash
g++ -o Pines Pines.cpp -I/usr/local/include/librpiplc -L/usr/local/lib -lrpiplc
```

---

## 🐍 Rutinas en Python

1. Descargar la librería compatible con la versión **V6**:  
   [python3-librpiplc v4.0.1](https://github.com/Industrial-Shields/python3-librpiplc/releases/tag/v4.0.1)

2. Verificar versión de OS:

```bash
cat /etc/os-release
```

- Si es **Bullseye**:  
  ```bash
  sudo python3 -m pip install .
  ```

- Si es **Bookworm (o superior)**:

  ```bash
  sudo tee /etc/apt/sources.list.d/industrialshields.list > /dev/null <<EOF
  deb https://apps.industrialshields.com/main/DebRepo/ ./
  EOF

  wget -O - https://apps.industrialshields.com/main/DebRepo/PublicKey.gpg | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/IndustrialShieldsDebian.gpg > /dev/null
  sudo apt update
  ```

3. Verificar instalación:

```bash
python3 -m pip show rpiplc-lib
```

Debe mostrar algo como:  

```
Name: rpiplc-lib
Version: 4.0.1
Summary: Industrial Shields RPIPLC library for python3
Location: /usr/local/lib/python3.11/dist-packages/
```

4. Ejecutar programa en Python:

```bash
python3 programa.py
```

---

## 📡 MQTT

### Instalación en PC y PLC

```bash
sudo apt update
sudo apt install mosquitto mosquitto-clients -y
```

Iniciar broker:

```bash
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
mosquitto -v
```

Verificar estado:

```bash
sudo systemctl status mosquitto
sudo lsof -i :1883
```

### Configuración

Editar configuración:

```bash
sudo nano /etc/mosquitto/mosquitto.conf
```

Ejemplo con autenticación y ACL:

```conf
listener 1883 0.0.0.0
allow_anonymous false
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/aclfile

connection_messages true
log_type all
```

Crear usuario:

```bash
sudo mosquitto_passwd -c /etc/mosquitto/passwd plcuser
```

Archivo ACL:

```conf
user plcuser
topic readwrite Plc/Adc
topic readwrite Plc/Ia
topic readwrite Plc/Pwm
topic readwrite Plc/Timer
topic readwrite Plc/Setpoint
```

Reiniciar servicio:

```bash
sudo systemctl restart mosquitto
```

### Ejemplos

- Suscribirse:

```bash
mosquitto_sub -h localhost -t "Plc/#" -u plcuser -P "plc"
```

- Publicar:

```bash
mosquitto_pub -h localhost -t "Plc/Adc" -m "123" -u plcuser -P "plc"
```

---

## 🟢 Rutinas en Node.js

### Configuración

```bash
npm install -g node-gyp
npm install node-addon-api
```

Archivo `binding.gyp`:

```json
{
  "targets": [
    {
      "target_name": "rpiplc",
      "sources": [ "rpiplc_wrapper.cpp" ],
      "include_dirs": [
        "<!@(node -p "require('node-addon-api').include")",
        "/usr/local/include/librpiplc"
      ],
      "libraries": [ "-lrpiplc" ],
      "cflags": [ "-Wall" ],
      "cflags_cc": [ "-std=c++17", "-fexceptions" ],
      "defines": [ "NAPI_CPP_EXCEPTIONS", "RPIPLC_V6", "RPIPLC_58" ]
    }
  ]
}
```

Archivo `rpiplc_wrapper.cpp`: *(resumido, incluye funciones `writeDigital`, `readDigital`, `readADC`, `writePWM`)*

Compilar:

```bash
node-gyp clean
node-gyp configure
node-gyp build
```

### Ejemplo en Node.js

`prueba.js`:

```js
const plc = require('./build/Release/rpiplc');

const Q0_0_PIN = 20971532;

console.log("Encendiendo Q0.0...");
plc.writeDigital(Q0_0_PIN, 1);

setTimeout(() => {
    console.log("Apagando Q0.0...");
    plc.writeDigital(Q0_0_PIN, 0);
}, 2000);
```

Ejecutar:

```bash
node prueba.js
```

---

## ⚡ OpenPLC con Industrial Shields

### En el PC

1. Descargar instalador oficial:  
   [Autonomy Logic Linux Download](https://autonomylogic.com/download-linux)

2. Instalar:

```bash
sudo apt update
sudo apt install git python3-pip -y
pip3 install openplc_editor
```

3. Ejecutar:

```bash
openplc_editor
```

### En la Raspberry

```bash
git clone https://github.com/thiagoralves/OpenPLC_v3.git
cd OpenPLC_v3
./install.sh rpi
sudo systemctl status openplc.service
```

Referencia: [Industrial Shields OpenPLC](https://www.industrialshields.com/es_ES/blog/raspberry-pi-para-la-industria-26/analisis-de-la-respuesta-temporal-del-pinout-del-plc-raspberry-pi-540)

---

## 📑 Referencias

- [Industrial Shields Librerías](https://github.com/Industrial-Shields/librpiplc)  
- [Python RPIPLC](https://github.com/Industrial-Shields/python3-librpiplc/releases)  
- [Mosquitto MQTT](https://mosquitto.org/)  
- [OpenPLC](https://github.com/thiagoralves/OpenPLC_v3)

https://mathias.rocks/blog/2024-09-19-how-to-install-n8n-on-raspberry-pi