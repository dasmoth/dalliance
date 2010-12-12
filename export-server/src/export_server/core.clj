(ns export-server.core
  (:use compojure.core ring.adapter.jetty clojure.java.io clojure.java.shell)
  (:require [compojure.route :as route])
  (:gen-class))

(def server-port 8765)
(def rasterizer-path "/usr/local/batik/batik-rasterizer.jar")

(defn- tempfile [suffix]
  (java.io.File/createTempFile "dalliance-export" suffix))

(defn- post-svg [request]
  {:status 200
   :headers {"Content-Type" "image/svg"}
   :body (get-in request '(:params "svgdata"))})

(defn- post-pdf [request]
  (let [svg-temp (tempfile ".svg")
	pdf-temp (tempfile ".pdf")]
    (spit svg-temp  (get-in request '(:params "svgdata")))
    (println (sh "java" "-jar" rasterizer-path
	"-m" "application/pdf"
	"-d" (.getPath pdf-temp)
	(.getPath svg-temp)))
    {:status 200
     :headers {"Content-Type" "application/pdf"}
     :body pdf-temp}))

(defroutes exporter
  (POST "/browser-image.svg" [] post-svg)
  (POST "/browser-image.pdf" [] post-pdf)
  (route/not-found "Errer!"))

(defn -main []
  (System/setProperty "java.awt.headless" "true")
  (run-jetty exporter {:port server-port}))