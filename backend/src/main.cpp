#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 2
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);


struct SensorData
{
  float temperature;
  float turbidity;
};
SensorData data;

int temperature_sensorPin = 2;
int turbidity_sensorPin = A0;

void setup()
{
  Serial.begin(9600);
  tempSensor.begin();
  pinMode(turbidity_sensorPin, INPUT);
  pinMode(temperature_sensorPin, INPUT);
}

float analogreadSensor(int pin)
{
  int sensorValue = 0;
  float sumvoltage = 0;
  for(int i = 0; i < 10; i++)
  {
    sensorValue = analogRead(pin);
    sumvoltage += sensorValue * (5.0 / 1023.0);
  }
  return sumvoltage/10.0;
}

float turbidityConversion(float voltage)
{
  float turbudity = map(voltage, 0, 640, 100, 0) - 25;
  return turbudity; // Example conversion for turbidity sensor
}


void loop()
{
  tempSensor.requestTemperatures();
  data.temperature = tempSensor.getTempCByIndex(0);
  data.turbidity = turbidityConversion(analogRead(turbidity_sensorPin));
  Serial.print(F("{\"pH\":"));
  Serial.print("0");
  Serial.print(F(",\"temperature\":"));
  Serial.print(data.temperature, 2);
  Serial.print(F(",\"turbidity\":"));
  Serial.print(data.turbidity, 1);
  Serial.print(F(",\"tds\":"));
  Serial.print("0");
  Serial.println(F("}"));
  delay(1000);
}
