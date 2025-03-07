/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/articlepage`; params?: Router.UnknownInputParams; } | { pathname: `/editprofile`; params?: Router.UnknownInputParams; } | { pathname: `/followingpage`; params?: Router.UnknownInputParams; } | { pathname: `/`; params?: Router.UnknownInputParams; } | { pathname: `/loginstatus`; params?: Router.UnknownInputParams; } | { pathname: `/preferences`; params?: Router.UnknownInputParams; } | { pathname: `/repostfeed`; params?: Router.UnknownInputParams; } | { pathname: `/savedarticles`; params?: Router.UnknownInputParams; } | { pathname: `/ScrollContext`; params?: Router.UnknownInputParams; } | { pathname: `/searchpage`; params?: Router.UnknownInputParams; } | { pathname: `/settings`; params?: Router.UnknownInputParams; } | { pathname: `/trending`; params?: Router.UnknownInputParams; } | { pathname: `/tweetpage`; params?: Router.UnknownInputParams; } | { pathname: `/UserContext`; params?: Router.UnknownInputParams; } | { pathname: `/contentchoice`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/articlepage`; params?: Router.UnknownOutputParams; } | { pathname: `/editprofile`; params?: Router.UnknownOutputParams; } | { pathname: `/followingpage`; params?: Router.UnknownOutputParams; } | { pathname: `/`; params?: Router.UnknownOutputParams; } | { pathname: `/loginstatus`; params?: Router.UnknownOutputParams; } | { pathname: `/preferences`; params?: Router.UnknownOutputParams; } | { pathname: `/repostfeed`; params?: Router.UnknownOutputParams; } | { pathname: `/savedarticles`; params?: Router.UnknownOutputParams; } | { pathname: `/ScrollContext`; params?: Router.UnknownOutputParams; } | { pathname: `/searchpage`; params?: Router.UnknownOutputParams; } | { pathname: `/settings`; params?: Router.UnknownOutputParams; } | { pathname: `/trending`; params?: Router.UnknownOutputParams; } | { pathname: `/tweetpage`; params?: Router.UnknownOutputParams; } | { pathname: `/UserContext`; params?: Router.UnknownOutputParams; } | { pathname: `/contentchoice`; params?: Router.UnknownOutputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; };
      href: Router.RelativePathString | Router.ExternalPathString | `/articlepage${`?${string}` | `#${string}` | ''}` | `/editprofile${`?${string}` | `#${string}` | ''}` | `/followingpage${`?${string}` | `#${string}` | ''}` | `/${`?${string}` | `#${string}` | ''}` | `/loginstatus${`?${string}` | `#${string}` | ''}` | `/preferences${`?${string}` | `#${string}` | ''}` | `/repostfeed${`?${string}` | `#${string}` | ''}` | `/savedarticles${`?${string}` | `#${string}` | ''}` | `/ScrollContext${`?${string}` | `#${string}` | ''}` | `/searchpage${`?${string}` | `#${string}` | ''}` | `/settings${`?${string}` | `#${string}` | ''}` | `/trending${`?${string}` | `#${string}` | ''}` | `/tweetpage${`?${string}` | `#${string}` | ''}` | `/UserContext${`?${string}` | `#${string}` | ''}` | `/contentchoice${`?${string}` | `#${string}` | ''}` | `/_sitemap${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/articlepage`; params?: Router.UnknownInputParams; } | { pathname: `/editprofile`; params?: Router.UnknownInputParams; } | { pathname: `/followingpage`; params?: Router.UnknownInputParams; } | { pathname: `/`; params?: Router.UnknownInputParams; } | { pathname: `/loginstatus`; params?: Router.UnknownInputParams; } | { pathname: `/preferences`; params?: Router.UnknownInputParams; } | { pathname: `/repostfeed`; params?: Router.UnknownInputParams; } | { pathname: `/savedarticles`; params?: Router.UnknownInputParams; } | { pathname: `/ScrollContext`; params?: Router.UnknownInputParams; } | { pathname: `/searchpage`; params?: Router.UnknownInputParams; } | { pathname: `/settings`; params?: Router.UnknownInputParams; } | { pathname: `/trending`; params?: Router.UnknownInputParams; } | { pathname: `/tweetpage`; params?: Router.UnknownInputParams; } | { pathname: `/UserContext`; params?: Router.UnknownInputParams; } | { pathname: `/contentchoice`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; };
    }
  }
}
