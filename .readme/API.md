# API
## Functions

<dl>
<dt><a href="#initCloudPages">initCloudPages($, [name], [dependencies])</a> ⇒ <code>undefined</code></dt>
<dd><p>Declare <code>cloudPages</code> in the dependency injection system
and allow to change its name/dependencies</p>
</dd>
<dt><a href="#cloudPages">cloudPages(services, options)</a> ⇒ <code>Promise</code></dt>
<dd><p>Deploy pages to the cloud and optionnally remove old versions</p>
</dd>
</dl>

<a name="initCloudPages"></a>

## initCloudPages($, [name], [dependencies]) ⇒ <code>undefined</code>
Declare `cloudPages` in the dependency injection system
and allow to change its name/dependencies

**Kind**: global function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| $ | <code>Knifecycle</code> |  | The knifecycle instance |
| [name] | <code>String</code> | <code>&#x27;cloudPages&#x27;</code> | The name of the service |
| [dependencies] | <code>Array</code> | <code>[&#x27;ENV&#x27;, &#x27;glob&#x27;, &#x27;fs&#x27;, &#x27;log&#x27;, &#x27;s3&#x27;, &#x27;mime&#x27;, &#x27;git&#x27;]</code> | The dependencies to inject |

<a name="cloudPages"></a>

## cloudPages(services, options) ⇒ <code>Promise</code>
Deploy pages to the cloud and optionnally remove old versions

**Kind**: global function  
**Returns**: <code>Promise</code> - A promise to be resolved when the deployment ended  

| Param | Type | Description |
| --- | --- | --- |
| services | <code>Object</code> | Services (provided by the dependency injector) |
| services.ENV | <code>Object</code> | Environment service |
| services.glob | <code>function</code> | Globbing service |
| services.fs | <code>Object</code> | File system service |
| services.log | <code>function</code> | Logging service |
| services.s3 | <code>Object</code> | S3 bucket service |
| services.mime | <code>Object</code> | MIME mapping service |
| services.git | <code>Object</code> | Repository service |
| services.time | <code>function</code> | Time service |
| options | <code>Object</code> | Options (destructured) |
| options.last | <code>Number</code> | Number of prior versions to keep |
| options.delay | <code>Number</code> | Delay for keeping prior versions |
| options.dir | <code>String</code> | Directory that contains assets to deploy |
| options.gitDir | <code>String</code> | Directory of the git repository to look for versions |
| options.files | <code>String</code> | Pattern of files to deploy in the directory |
| options.ignore | <code>String</code> | Pattern of files to ignore in the directory |
| options.remove | <code>Boolean</code> | Boolean indicating if ld versions should be removed |
| options.version | <code>String</code> | Version for the current deployment |
| options.bucket | <code>String</code> | Targetted bucket |

