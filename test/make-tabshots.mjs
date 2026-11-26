import fs from "node:fs";
const src = fs.readFileSync("gcode-universal.html","utf8");
const tabs = {scene:"scene", threads:"threads", import:"import", arc:"arc", ref:"ref"};
for (const [name, tab] of Object.entries(tabs)){
  const inject = `<script>setTimeout(function(){ var b=document.querySelector('.tab[data-tab="${tab}"]'); if(b) b.click(); }, 300);</script>`;
  fs.writeFileSync(`preview/ui-${name}.html`, src.replace("</body>", inject + "</body>"));
}
console.log("variants ready");
