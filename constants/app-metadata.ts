const appConfig = require('../app.json');

export const CURRENT_APP_VERSION: string = appConfig?.expo?.version ?? '0.0.0';
