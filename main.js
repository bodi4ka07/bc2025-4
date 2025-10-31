const http = require('http');
const fs = require('fs').promises;
const url = require('url');
const { Command } = require('commander');
const { XMLBuilder } = require('fast-xml-parser');

const program = new Command();

program
  .requiredOption('-i, --input <path>', 'шлях до файлу для читання')
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера');

program.parse(process.argv);

const options = program.opts();

// Перевірка існування файлу
fs.access(options.input)
  .catch(() => {
    console.error('Cannot find input file');
    process.exit(1);
  });

  
const server = http.createServer(async (req, res) => {
  try {
    // Парсинг URL та query параметрів
    const parsedUrl = url.parse(req.url, true);
    const query = parsedUrl.query;

   const fileData = await fs.readFile(options.input, 'utf8');

// Розділити файл на рядки, прибрати порожні
const lines = fileData.split('\n').filter(line => line.trim() !== '');

// Кожен рядок окремо парсимо в JSON
const flights = lines.map(line => {
  try {
    return JSON.parse(line);
  } catch (err) {
    console.error('Помилка парсингу рядка:', line);
    return null;
  }
}).filter(f => f !== null);


    // Фільтрація даних
    let filteredFlights = flights;

    // Фільтр за мінімальним часом у повітрі
    if (query.airtime_min) {
      const minAirtime = parseFloat(query.airtime_min);
      filteredFlights = filteredFlights.filter(flight => {
  const air = parseFloat(flight.AIR_TIME);
  return !isNaN(air) && air > minAirtime;
});
    }
      

    // Формування результату
    const result = filteredFlights.map(flight => {
      const flightData = {};

      // Додаємо дату якщо параметр date=true
      if (query.date === 'true') {
        flightData.date = flight.FL_DATE;
      }

      flightData.air_time = flight.AIR_TIME;
      flightData.distance = flight.DISTANCE;

      return flightData;
    });

    // Формування XML
    const xmlData = {
      flights: {
        flight: result
      }
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true
    });

    const xmlContent = builder.build(xmlData);

    // Відправка відповіді
    res.writeHead(200, { 
      'Content-Type': 'application/xml; charset=utf-8'
    });
    res.end(xmlContent);

  } catch (error) {
    console.error('Error processing request:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
}).on('error', (err) => {
  if (err.code === 'EACCES') {
    console.error(`Permission denied to use port ${options.port}. Try a different port or run as administrator.`);
  } else if (err.code === 'EADDRINUSE') {
    console.error(`Port ${options.port} is already in use. Try a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
}); 