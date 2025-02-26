// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as express from 'express';
import { Application, static as StaticHandler } from 'express';
import * as proxy from 'http-proxy-middleware';
import fetch from 'node-fetch';
import * as path from 'path';
import * as process from 'process';

const BASEPATH = '/metadata';

/** All configurable environment variables can be found here. */
const {
  /** API service will listen to this host */
  METADATA_SERVICE_SERVICE_HOST = 'localhost',
  /** API service will listen to this port */
  METADATA_SERVICE_SERVICE_PORT = '8080'
} = process.env;

const app = express() as Application;

app.use(function (req, _, next) {
  console.info(req.method + ' ' + req.originalUrl);
  next();
});

if (process.argv.length < 3) {
  console.error(`\
Usage: node server.js <static-dir> [port].
       You can specify the API server address using the
       METADATA_SERVICE_HOST and ML_PIPELINE_SERVICE_PORT
       env vars.`);
  process.exit(1);
}

const staticDir = path.resolve(process.argv[2]);

const port = process.argv[3] || 3000;
const apiServerAddress = `http://${METADATA_SERVICE_SERVICE_HOST}:${METADATA_SERVICE_SERVICE_PORT}`;

const v1beta1Prefix = 'api/v1alpha1';

const clusterNameHandler = async (req, res) => {
  const response = await fetch(
    'http://metadata/computeMetadata/v1/instance/attributes/cluster-name',
    { headers: {'Metadata-Flavor': 'Google' } }
  );
  res.send(await response.text());
};

const projectIdHandler = async (req, res) => {
  const response = await fetch(
    'http://metadata/computeMetadata/v1/project/project-id',
    { headers: {'Metadata-Flavor': 'Google' } }
  );
  res.send(await response.text());
};

app.get('/system/cluster-name', clusterNameHandler);
app.get(BASEPATH + '/system/cluster-name', clusterNameHandler);

app.get('/system/project-id', projectIdHandler);
app.get(BASEPATH + '/system/project-id', projectIdHandler);

app.all('/' + v1beta1Prefix + '/*', proxy({
  changeOrigin: true,
  onProxyReq: proxyReq => {
    console.log('Proxied request: ', (proxyReq as any).path);
  },
  target: apiServerAddress,
}));

app.all(BASEPATH  + '/' + v1beta1Prefix + '/*', proxy({
  changeOrigin: true,
  onProxyReq: proxyReq => {
    console.log('Proxied request: ', (proxyReq as any).path);
  },
  pathRewrite: (path) =>
    path.startsWith(BASEPATH) ? path.substr(BASEPATH.length, path.length) : path,
  target: apiServerAddress,
}));

app.use(BASEPATH, StaticHandler(staticDir));
app.use(StaticHandler(staticDir));

app.get('*', (req, res) => {
  // TODO: look into caching this file to speed up multiple requests.
  res.sendFile(path.resolve(staticDir, 'index.html'));
});

app.listen(port, () => {
  console.log('Server listening at http://localhost:' + port);
});
