const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUt09qwkX67lDTuKG0G0ItUUtNJTM-Cn0hxznvEHqY3XgKQFpjta7qXySNZ5cmnGQzSPEiiEnC92nt/pub?output=csv";
const REFRESH_INTERVAL = 30_000;

const medals = [
  { icon: "&#9733;", className: "gold", label: "Gold medal" },
  { icon: "&#9670;", className: "silver", label: "Silver medal" },
  { icon: "&#9679;", className: "bronze", label: "Bronze medal" }
];

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const leaderboardBody = document.querySelector("#leaderboard-body");
const updatedTime = document.querySelector("#updated-time");
let isLoading = false;

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseTurnover(value) {
  const digits = String(value).replace(/[^\d-]/g, "");
  const turnover = Number(digits);
  return Number.isFinite(turnover) ? turnover : 0;
}

function csvToPlayers(csv) {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const usernameIndex = headers.findIndex((header) =>
    ["username", "user", "player", "name", "nama"].includes(header)
  );
  const turnoverIndex = headers.findIndex((header) =>
    ["totalturnover", "turnover", "totalbet", "total"].includes(header)
  );

  if (usernameIndex === -1 || turnoverIndex === -1) {
    throw new Error("CSV must contain Username and Total Turnover columns.");
  }

  return rows.slice(1)
    .map((row) => ({
      username: row[usernameIndex]?.trim(),
      turnover: parseTurnover(row[turnoverIndex])
    }))
    .filter((player) => player.username && player.turnover >= 0);
}

function createCell(className, text) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderLeaderboard(players) {
  const sortedTopTen = [...players]
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, 10);

  leaderboardBody.replaceChildren();

sortedTopTen.forEach((player, index) => {

    const rank = index + 1;

    const row = document.createElement("tr");

    const rankCell = document.createElement("td");
    rankCell.className = "rank";

    const rankDisplay =
        `<span class="position">${String(rank).padStart(2, "0")}</span>`;

rankCell.innerHTML = rankDisplay;

row.append(
    rankCell,
    createCell("username", player.username),
    createCell("turnover", rupiah.format(player.turnover))
);

leaderboardBody.appendChild(row);

});

if (!sortedTopTen.length) showMessage("No leaderboard data available.");
}

function showMessage(message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 3;
  cell.textContent = message;
  cell.style.textAlign = "center";
  cell.style.color = "#777";
  row.appendChild(cell);
  leaderboardBody.replaceChildren(row);
}

async function updateLeaderboard() {
  if (isLoading) return;
  isLoading = true;

  try {
    const separator = CSV_URL.includes("?") ? "&" : "?";
    const response = await fetch(
  `${CSV_URL}${separator}t=${Date.now()}`,
  { cache: "no-store" }
);
    if (!response.ok) throw new Error(`CSV request failed with status ${response.status}.`);

    renderLeaderboard(csvToPlayers(await response.text()));
    updatedTime.textContent = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    console.error("Unable to update leaderboard:", error);
    if (!leaderboardBody.children.length) showMessage("Unable to load leaderboard. Retrying shortly...");
  } finally {
    isLoading = false;
  }
}

showMessage("Loading leaderboard...");
updateLeaderboard();
setInterval(updateLeaderboard, REFRESH_INTERVAL);
