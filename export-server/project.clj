(defproject export-server "0.0.1-SNAPSHOT"
  :description "Small server process to assist in file export from Dalliance"
  :dependencies [[org.clojure/clojure "1.2.0"]
                 [org.clojure/clojure-contrib "1.2.0"]
		 [compojure "0.5.3"]
		 [ring/ring-jetty-adapter "0.3.1"]]
  :keep-non-project-classes true
  :main export-server.core)
