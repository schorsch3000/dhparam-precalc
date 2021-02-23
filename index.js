const express = require("express");
const app = express();
const port = 3000;
const config = require("./config.json");
const shellescape = require("shell-escape");
const { exec } = require("child_process");
const os = require("os");
const cpuCount = os.cpus().length;
const modules = {};
const queue = [];
const running = [];

if (config.maxGenerators <= 0) {
  config.maxGenerators = os.cpus().length + config.maxGenerators;
  if (config.maxGenerators < 1) {
    config.maxGenerators = 1;
  }
}
if (config.maxGenerators > cpuCount) {
  config.maxGenerators = cpuCount;
}

for (let size in config.dhparam) {
  modules[size] = {
    params: [],
    target: config.dhparam[size],
  };
}

let generator = function () {
  if (!queue.length) {
    for (let size in modules) {
      let module = modules[size];
      let missing = module.target;
      missing -= module.params.length;
      missing -= running.filter((e) => {
        return e == size;
      });
      while (missing-- > 0) {
        queue.push(size);
      }
    }
    for (let x = 2 * queue.length; x; x--) {
      queue.sort((a, b) => {
        return Math.random() < 0.5;
      });
    }
  }
  while (queue.length && running.length < config.maxGenerators) {
    let nextSize = queue.shift();
    running.push(nextSize);
    exec(
      shellescape(["openssl", "dhparam", nextSize]),
      (error, stdout, stderr) => {
        let idx = running.indexOf(nextSize);
        if (idx > -1) {
          running.splice(idx, 1);
        }
        if (error) {
          console.log(
            "generating params broke, error: " +
              JSON.stringify(error) +
              "\nSTDERR: " +
              stderr +
              "\n\n"
          );
          generator();
          return;
        }
        modules[nextSize].params.push(stdout);
        generator();
      }
    );
  }
};

setInterval(generator, 60 * 1000);
generator();
app.get("/", (req, res) => {
  res.redirect('/stats')
})
app.get("/stats", (req, res) => {
  let data = {
    params: {},
    running,
    queue,
    maxGenerators: config.maxGenerators,
  };
  for (let size in modules) {
    data.params[size] = {
      fetchUrl: "/" + size,
      stored: modules[size].params.length,
      target: modules[size].target,
    };
  }
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(data, null, 4));
});

for (let size in modules) {
  let module = modules[size];
  app.get("/" + size, (req, res) => {
    let interval = setInterval(() => {
      generator();
      if (!module.params.length) return;
      clearInterval(interval);
      res.header("Content-Type", "text/plain");
      res.send(module.params.shift());
    }, 100);
  });
}

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
