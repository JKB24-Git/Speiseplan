import { readdir, readFile, writeFile } from "node:fs/promises";

const weeksDirectory = "weeks";
const dishesPath = "dishes.json";
const weekFiles = (await readdir(weeksDirectory))
  .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
  .sort();
const dishes = JSON.parse(await readFile(dishesPath, "utf8"));
let added = 0;

for (const file of weekFiles) {
  const week = JSON.parse(await readFile(`${weeksDirectory}/${file}`, "utf8"));
  for (const day of Array.isArray(week.days) ? week.days : []) {
    for (const mealName of ["lunch", "dinner"]) {
      const items = day && day[mealName];
      if (!Array.isArray(items) || items.length < 2) continue;
      const mainDish = items[items.length - 2];
      const name = typeof mainDish?.name === "string" ? mainDish.name.trim() : "";
      if (!name || Object.prototype.hasOwnProperty.call(dishes, name)) continue;
      dishes[name] = { description: "", image: "", link: "" };
      added += 1;
    }
  }
}

if (added > 0) {
  await writeFile(dishesPath, JSON.stringify(dishes, null, 2) + "\n", "utf8");
}
console.log(`Added ${added} main dish placeholder(s) from ${weekFiles.length} week file(s).`);
