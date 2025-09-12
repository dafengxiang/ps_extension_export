import Vue from "vue";
import App from "./App.vue";

const { entrypoints } = require("uxp");

entrypoints.setup({
  panels: {
    ps_export_panel: {
      show() {
        new Vue({
          el: "#container",
          components: { App },
          render(h) {
            return h(App);
          },
        });
      },
    },
  },
});
