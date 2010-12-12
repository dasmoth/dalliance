(ns export-server.core
  (:use compojure.core ring.adapter.jetty)
  (:require [compojure.route :as route])
  (:gen-class))

(def server-port 8765)

(defn- post-svg [request]
  {:status 200
   :headers {"Content-Type" "image/svg"}
   :body (get-in request '(:params "svgdata"))})

(defroutes exporter
  (POST "/browser-image.svg" [] post-svg)
  (route/not-found "Errer!"))

(defn -main []
  (run-jetty exporter {:port server-port}))