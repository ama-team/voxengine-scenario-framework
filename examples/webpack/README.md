# Sample Webpack scenario

This is sample scenario that is bundled together with framework using 
Webpack.

To build it, simply install dependencies and call `npm run build`,
which will emit result into `dist/scenario.js`

The scenario itself is invoked via HTTP and expects `{target: phone number}`
JSON-encoded object in custom data:

```bash
curl -XGET 'https://api.voximplant.com/platform_api/StartScenarios?account_id=%ACCOUNT ID%&api_key=%API KEY%&rule_id=%RULEID%&script_custom_data=\{"target":"%PHONE NUMBER%"\}'
```

After that scenario will try to call that target and say him he's handome.

As simple as that!
