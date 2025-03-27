import { EventSource } from "eventsource";
import termkit from "terminal-kit";
import { instrumentNames } from "./src/instruments";

const term = termkit.terminal;

// Create a screen buffer for efficient updates
let screenBuffer = new termkit.ScreenBuffer({ dst: term });

let clients: {
  /** Name, max 16 characters. Note that it may contain trailing or leading whitespaces - should be trimmed. */
  name: string;

  /** City */
  city: string;

  /** QT country number */
  country: number;

  /** 0 - Unspecified, 1 - Beginner, 2 - Intermediate, 3 - Expert */
  skillLevel: number;

  /** See `instrumentNames` */
  instrument: number;
}[] = [];

/** Each item corresponds to each client. Range is 0-8. */
let levels: number[] = [];

const eventSource = new EventSource("https://" + process.argv[2] + "/events");

// Initialize screen
term.clear();
// term.hideCursor();

// Function to get formatted current time
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString();
}

// Function to render the table
function renderTable(fullRefresh = false) {
  if (fullRefresh) {
    // Only clear the screen on full refresh
    term.clear();
    screenBuffer = new termkit.ScreenBuffer({ dst: term });
  }

  // Write to the buffer instead of directly to the terminal
  screenBuffer.fill({ char: " ", attr: {} });

  // Table header with current time
  screenBuffer.put(
    { x: 2, y: 1, attr: { bgColor: "yellow", color: "black", bold: true } },
    " Jamulus stream "
  );
  screenBuffer.put({ x: 2, y: 3, attr: { color: "cyan", bold: true } }, "Name");
  screenBuffer.put(
    { x: 22, y: 3, attr: { color: "cyan", bold: true } },
    "Level"
  );
  screenBuffer.put(
    { x: 42, y: 3, attr: { color: "cyan", bold: true } },
    "Instrument"
  );
  screenBuffer.put({ x: 22, y: 1, attr: { color: "white" } }, getCurrentTime());

  // Separator line
  screenBuffer.put({ x: 2, y: 4, attr: { color: "cyan" } }, "─".repeat(60));

  // If no clients, show message
  if (!clients.length) {
    screenBuffer.put({ x: 2, y: 5 }, "No users connected.");
  } else {
    // Display each client
    let cy = 5;
    clients.forEach((client, index) => {
      const name = client.name.trim();
      const instrument = instrumentNames[client.instrument] || "Unknown";
      const level = levels[index] !== undefined ? levels[index] : 0;
      if (!name) return; // Skip if name is empty

      const y = cy++;

      // Calculate bar length (8 chars for level 8)
      const barLength = Math.floor((level / 8) * 16);
      const levelBar = "|".repeat(barLength);

      // Write client info to buffer
      screenBuffer.put({ x: 2, y }, name);

      // Color the level bar based on intensity
      const barColor = level <= 6 ? "green" : level <= 7 ? "yellow" : "red";
      screenBuffer.put({ x: 22, y, attr: { color: barColor } }, levelBar);

      screenBuffer.put({ x: 42, y, attr: { color: "gray" } }, instrument);
    });
  }

  // Draw the buffer to the terminal
  screenBuffer.draw({ delta: true });
  term.moveTo(19, 2); // Move cursor to the top left
}

// Initial render with full refresh
renderTable(true);

// Update when data changes
eventSource.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.clients) {
    clients = data.clients;
  }
  if (data.levels) {
    levels = data.levels;
  }

  // Re-render the table with updated data (no full refresh)
  renderTable(false);
});

// Handle keyboard input
term.on("key", (key) => {
  if (key === "CTRL_C" || key === "q") {
    term.clear();
    term.grabInput(false);
    process.exit();
  } else if (key === "r") {
    // 'r' key for full refresh
    renderTable(true);
  }
});

// Handle terminal resize
term.on("resize", (width: number, height: number) => {
  // Update the screen buffer dimensions and do a full refresh
  screenBuffer.resize({ width, height });
  renderTable(true);
});

term.grabInput(true);
