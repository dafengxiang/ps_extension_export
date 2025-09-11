import Vue from "vue";
import hello from "./hello.vue";

const { entrypoints } = require("uxp");

entrypoints.setup({
  panels: {
    helloworld: {
      show() {
        new Vue({
          el: "#container",
          components: { hello },
          render(h) {
            return h(hello);
          },
        });
      },
    },
  },
});
