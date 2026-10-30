import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const databasePath = path.join(dataDirectory, "db.json");

async function readDatabase() {
  try {
    return JSON.parse(await readFile(databasePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    await mkdir(dataDirectory, { recursive: true });
    const database = { agents: [] };
    await writeFile(databasePath, JSON.stringify(database, null, 2));
    return database;
  }
}

async function writeDatabase(database) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(databasePath, JSON.stringify(database, null, 2));
}

export async function getAgent(id) {
  const database = await readDatabase();
  return database.agents.find((agent) => agent.id === id);
}

export async function listAgents() {
  const database = await readDatabase();
  return database.agents;
}

export async function saveAgent(agent) {
  const database = await readDatabase();
  const index = database.agents.findIndex((item) => item.id === agent.id);

  if (index === -1) {
    database.agents.push(agent);
  } else {
    database.agents[index] = agent;
  }
  await writeDatabase(database);
  return agent;
}

export async function addVersion(id, spec) {
  const database = await readDatabase();
  const agent = database.agents.find((item) => item.id === id);

  if (!agent) {
    throw new Error(`Agent not found: ${id}`);
  }

  agent.versions ??= [];
  agent.versions.push({
    n: agent.versions.length + 1,
    spec,
    createdAt: new Date().toISOString(),
  });
  agent.updatedAt = new Date().toISOString();
  await writeDatabase(database);
  return agent;
}
