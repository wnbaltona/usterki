const path = require('path');
const siteRoot = path.resolve(__dirname, '..');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=siteRoot+path.sep;let call,authError=null;
const ctx={URL,URLSearchParams,location:{href:'https://example.org/serwis/index.html?ticket=123#fragment',search:'',hash:''},history:{replaceState:()=>{}},MICROSOFT_LOGIN_ENABLED:true,PASSWORD_LOGIN_ENABLED:false,authUser:null,window:{},document:{documentElement:{dataset:{}}},esc:x=>String(x),icon:()=>'',rememberedLoginEmail:()=>'',authEye:()=>'',authClient:{auth:{signInWithOAuth:async options=>{call=options;return {error:authError};}}}};
ctx.testClient=ctx.authClient;
vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'microsoft-auth.js','utf8'),ctx);const core=fs.readFileSync(root+'app-core.js','utf8');vm.runInContext(core.slice(core.indexOf('function loginView('),core.indexOf('function syncSidebar(')),ctx);
vm.runInContext('authClient = testClient',ctx);
(async()=>{
 let html=ctx.loginView();assert(html.includes('login-microsoft'));assert(!html.includes('id="login-form"'));assert(html.includes('id="auth-help"'));
 ctx.PASSWORD_LOGIN_ENABLED=true;html=ctx.loginView();assert(html.includes('id="login-form"'));
 await ctx.signInMicrosoft();assert.equal(call.provider,'azure');assert.equal(call.options.scopes,'email');assert.equal(call.options.redirectTo,'https://example.org/serwis/index.html');
 authError=Error('Provider disabled');await assert.rejects(ctx.signInMicrosoft(),/Provider disabled/);authError=null;
 ctx.MICROSOFT_LOGIN_ENABLED=false;assert(!ctx.loginView().includes('login-microsoft'));await assert.rejects(ctx.signInMicrosoft(),/nie jest jeszcze/);
 ctx.location.search='?error=access_denied';assert(ctx.authReturnError());let cleaned;
 ctx.location.href='https://example.org/serwis/index.html?ticket=123&code=secret';ctx.history.replaceState=(a,b,url)=>cleaned=url;ctx.clearAuthReturnUrl();assert.equal(cleaned,'/serwis/index.html?ticket=123');
 vm.runInContext("authUser={identities:[{provider:'azure'}]}",ctx);assert(ctx.accountUsesMicrosoft());
 console.log('OK: Microsoft-only login, fallback, scope, redirect, error and callback cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
