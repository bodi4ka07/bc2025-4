import http from "http";
import { Command } from "commander";
import fs from "fs/promises";
import { XMLBuilder } from "fast-xml-parser";

// --- Командні аргументи ---
const program = new Command();
program
  .requiredOption("-i, --input <path>", "шлях до вхідного JSON-файлу")
  .requiredOption("-h, --host <host>", "адреса сервера")
  .requiredOption("-p, --port <port>", "порт сервера");

program.parse(process.argv);
const options = program.opts();

// --- Перевірка існування файлу ---
try {
  await fs.access(options.input);
} catch {
  console.error("Cannot find input file");
  process.exit(1);
}

// --- Створення HTTP сервера ---
const server = http.createServer(async (req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }

  try {
    // 1️⃣ Читаємо JSON файл
    const data = await fs.readFile(options.input, "utf-8");
    const flights = JSON.parse(data);

    // 2️⃣ Отримуємо параметри запиту
    const url = new URL(req.url, `http://${options.host}:${options.port}`);
    const showDate = url.searchParams.get("date") === "true";
    const airtimeMin = url.searchParams.get("airtime_min")
      ? parseInt(url.searchParams.get("airtime_min"))
      : null;

    // 3️⃣ Фільтрація даних
    let filtered = flights;
    if (airtimeMin) {
      filtered = filtered.filter(
        (f) => f.AIR_TIME && f.AIR_TIME > airtimeMin
      );
    }

    // 4️⃣ Формування XML структури
    const xmlData = {
      flights: filtered.slice(0, 50).map((f) => {
        const item = {
          air_time: f.AIR_TIME,
          distance: f.DISTANCE,
        };
        if (showDate) item.date = f.FL_DATE;
        return { flight: item };
      }),
    };

    // 5️⃣ Конвертація JSON → XML
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    const xml = builder.build(xmlData);

    // 6️⃣ Відправлення відповіді клієнту
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    res.end(xml);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Server error: " + err.message);
  }
});

// --- Запуск сервера ---
server.listen(parseInt(options.port), options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
