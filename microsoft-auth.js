'use strict';
function microsoftLoginEnabled(){return typeof MICROSOFT_LOGIN_ENABLED!=='undefined'&&MICROSOFT_LOGIN_ENABLED===true;}
function passwordLoginEnabled(){return typeof PASSWORD_LOGIN_ENABLED==='undefined'||PASSWORD_LOGIN_ENABLED===true;}
function accountUsesMicrosoft(){return (authUser?.identities||[]).some(identity=>identity.provider==='azure');}
function microsoftLoginButton(){return microsoftLoginEnabled()?'<button class="btn microsoft-login" type="button" data-action="login-microsoft"><svg aria-hidden="true" viewBox="0 0 21 21"><path fill="#f25022" d="M0 0h10v10H0z"/><path fill="#7fba00" d="M11 0h10v10H11z"/><path fill="#00a4ef" d="M0 11h10v10H0z"/><path fill="#ffb900" d="M11 11h10v10H11z"/></svg>Zaloguj przez Microsoft</button>':'';}
async function signInMicrosoft(){
 if(!microsoftLoginEnabled()||!authClient)throw Error('Logowanie Microsoft nie jest jeszcze skonfigurowane.');
 const redirect=new URL('./index.html',location.href);
 const {error}=await authClient.auth.signInWithOAuth({provider:'azure',options:{scopes:'email',redirectTo:redirect.href,queryParams:{prompt:'select_account'}}});
 if(error)throw Error('Nie udało się rozpocząć logowania Microsoft. '+error.message);
}
function microsoftAccountSecurity(){return '<h3>Logowanie Microsoft</h3><p class="account-microsoft-note">Hasło do konta firmowego zmienisz w ustawieniach Microsoft.</p><a class="btn secondary" href="https://myaccount.microsoft.com/" target="_blank" rel="noopener noreferrer">Otwórz konto Microsoft</a>';}
function authReturnError(){
 const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
 if(query.has('error')||hash.has('error'))return 'Logowanie nie zostało ukończone. Spróbuj ponownie lub skontaktuj się z IT.';
 return '';
}
function clearAuthReturnUrl(){
 const url=new URL(location.href),queryKeys=['code','error','error_code','error_description'];
 const hash=new URLSearchParams(url.hash.slice(1));
 const hasAuthHash=hash.has('access_token')||hash.has('error');
 const changed=queryKeys.some(key=>url.searchParams.has(key))||hasAuthHash;
 queryKeys.forEach(key=>url.searchParams.delete(key));
 if(hasAuthHash)url.hash='';
 if(changed)history.replaceState(null,'',url.pathname+url.search+url.hash);
}
