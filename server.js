require('dotenv').config();
const express = require('express');
const axios = require('axios');

const requiredEnvVars = [
    'OPENWEATHER_API_KEY',
    'TARGET_CITY',
    'BASEROW_API_URL',
    'BASEROW_API_TOKEN',
    'BASEROW_TABLE_ID'
];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error(`Erro: Variáveis de ambiente faltando: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;
const CITY = process.env.TARGET_CITY;
const BASEROW_URL = process.env.BASEROW_API_URL;
const BASEROW_TOKEN = process.env.BASEROW_API_TOKEN;
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID;

app.use(express.json());

app.get('/clima', async (req, res) => {
    console.log(`Recebida requisição para buscar clima de ${CITY}`);

    const openWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${OPENWEATHER_KEY}&units=metric&lang=pt_br`;
    let weatherData;

    try {
        const response = await axios.get(openWeatherUrl);
        console.log('Dados recebidos do OpenWeatherMap:', response.data);
        weatherData = response.data;

        if (!weatherData || !weatherData.main || weatherData.main.temp === null || weatherData.main.humidity === null || !weatherData.weather || !weatherData.weather[0] || !weatherData.weather[0].description) {
            console.error('Erro: Dados recebidos do OpenWeatherMap são inválidos ou incompletos.');
            return res.status(400).json({
                error: 'Dados meteorológicos inválidos ou incompletos recebidos da API externa.',
                data_received: weatherData
            });
        }

    } catch (error) {
        console.error('Erro ao buscar dados do OpenWeatherMap:', error.response?.data || error.message);
        const statusCode = error.response?.status === 404 ? 404 : 502;
        return res.status(statusCode).json({
            error: `Falha ao buscar dados meteorológicos para ${CITY}.`,
            details: error.response?.data?.message || error.message
        });
    }

    const temperature = weatherData.main.temp;
    const humidity = weatherData.main.humidity;
    const condition = weatherData.weather[0].description;
    const cityName = weatherData.name;

    console.log(`Dados extraídos: Cidade=${cityName}, Temp=${temperature}°C, Umidade=${humidity}%, Condição=${condition}`);

    const baserowApiUrl = `${BASEROW_URL}/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true`;
    const baserowPayload = {
        'Cidade': cityName,
        'Temperatura': temperature,
        'Umidade': humidity,
        'Condicao': condition
    };
    const baserowHeaders = {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
    };

    try {
        console.log(`Enviando para Baserow URL: ${baserowApiUrl}`);
        console.log(`Payload Baserow: ${JSON.stringify(baserowPayload)}`);

        const baserowResponse = await axios.post(baserowApiUrl, baserowPayload, { headers: baserowHeaders });
        console.log('Dados inseridos no Baserow com sucesso:', baserowResponse.data);

        res.status(201).json({
            message: `Dados meteorológicos de ${cityName} capturados e armazenados com sucesso no Baserow.`,
            data_stored: baserowResponse.data
        });

    } catch (error) {
        console.error('Erro ao inserir dados no Baserow:', error.response?.data || error.message);
        let detailedError = error.message;
        if (error.response?.data) {
            try {
                detailedError = JSON.stringify(error.response.data.detail || error.response.data.error || error.response.data);
            } catch (e) {
                 detailedError = error.response.data;
            }
        }

        res.status(500).json({
            error: 'Falha ao armazenar dados meteorológicos no Baserow.',
            details: detailedError,
            payload_sent: baserowPayload
        });
    }
});

app.get('/', (req, res) => {
    res.send('Servidor de Clima para Baserow está rodando. Use GET /clima para buscar e armazenar dados.');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Endpoint para buscar clima: http://localhost:${PORT}/clima`);
});