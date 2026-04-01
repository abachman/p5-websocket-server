const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

const viewsDir = path.resolve(__dirname, "../views");

function renderTemplate(templateName, context) {
  const src = fs.readFileSync(path.join(viewsDir, templateName + ".hbs"), "utf8");
  return Handlebars.compile(src)(context);
}

describe("handlebars templates", () => {
  describe("sketch.hbs", () => {
    it("renders the sketch name", () => {
      const html = renderTemplate("sketch", { name: "poppers", height: "600" });
      expect(html).toContain("poppers");
    });

    it("renders the sketch height", () => {
      const html = renderTemplate("sketch", { name: "poppers", height: "720" });
      expect(html).toContain("720");
    });
  });

  describe("embed.hbs", () => {
    it("renders the sketch name", () => {
      const html = renderTemplate("embed", { name: "line-drawings" });
      expect(html).toContain("line-drawings");
    });
  });

  describe("home.hbs", () => {
    it("renders without variables", () => {
      const html = renderTemplate("home", {});
      expect(html).toContain("p5.websockets");
    });
  });
});
