// mqttConectar.js
const mqtt = require('mqtt');
const { config } = require("dotenv");

config();

const brokerUrl = process.env.BROKER;
const options = {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  clientId: "NodeClient_" + Math.random().toString(16).substr(2, 8),
};

const mqttClient = mqtt.connect(brokerUrl, options);

// Lista de topics
const topics = [
  'Plc/Adc',
  'Plc/Ia',
  'Plc/Pwm',
  'Plc/Timer',
  'Plc/Control',
  'Plc/Supervisor', 
  'Plc/Respuesta'
];

// Buffer para los últimos N mensajes
const MAX_MENSAJES = 1000;
const mensajesPorTopic = {}; // { topic: [ { msg, timestamp } ] }

mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');

  topics.forEach(topic => {
    mqttClient.subscribe(topic, { qos: 1 }, (err) => {
      if (!err) console.log(`📡 Suscrito a ${topic}`);
      else console.error(`❌ Error suscribiéndose a ${topic}:`, err);
    });
  });
});

mqttClient.on('message', (topic, message) => {
  const msg = message.toString();   
  //console.log(`📥 [${topic}] => ${msg}`);

  if (!mensajesPorTopic[topic]) mensajesPorTopic[topic] = [];
  mensajesPorTopic[topic].push({ msg, timestamp: Date.now() });

  if (mensajesPorTopic[topic].length > MAX_MENSAJES) {
    mensajesPorTopic[topic].shift();
  }

  // 👇 Manejo especial para Plc/Respuesta
  // if (topic === 'Plc/Respuesta') {
  //   console.log('✅ Respuesta capturada:', msg);
  //   // aquí tu lógica extra (guardar DB, WebSocket, etc.)
  // }
});

mqttClient.on('error', (err) => {
  console.error('Error MQTT:', err);
});

// Publicar mensajes
function publicarMQTT(topic, mensaje) {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, mensaje, { qos: 1 }, (err) => {
      if (err) console.error(`❌ Error al publicar en ${topic}:`, err);
      else console.log(`📤 Publicado en ${topic}: ${mensaje}`);
    });
  } else {
    console.log('⚠️ Cliente MQTT no conectado');
  }
}

module.exports = {
  mqttClient,
  publicarMQTT,
  mensajesPorTopic
};
