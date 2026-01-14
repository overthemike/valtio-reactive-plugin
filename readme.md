# `valtio-reactive-plugin`

### Motivation
was working on porting over `valtio-persist` to use `valtio-plugin` when something occurred to me. There may be some _potential_ issues if `valtio-reactive` is used in conjunction with another plugin as they both use `unstable_replaceInternalFunction('createHandler', ...)`.

### What's different in `valtio-plugin` from before?
I modified `valtio-plugin` a bit to account for plugins that require the raw proxy for things like reactivity. I added an `onGetRaw` that will bypass the extra work needed for regular property reads so that the performance doesn't suffer. I added benchmarks to test this against `valtio-reactive` to make sure that it was comparable. In some cases, it's even faster.

### Implemntation concerns
"I'm not a big fan of it from valtio-reactive perspective. Implementation-wise, it's more indirect that seems harder to debug for me, and usage-wise, it's not compatible for native valtio proxy."

I wanted to see what I could do about this. This is a legit concern and I wanted to try and adjust. I still think there's more that can be done (like a good debug plugin), but I wanted to show you what I came up with so far and get your feedback on it.

### How it works
It can be attached to the main valtio proxy so that it will work globally, or it can be scoped to a factory instance like other plugins. `effect`, `batch`, and `watch` (even though it's deprecated) should work in almost the same way for the end user as before, with the exception that they are now attached to the plugin. I had to get creative with `computed` because that function in regular `valtio-reactive`, it uses the `proxy` function from valtio instead of receiving the proxy factory instance it would supposed to be bound to. I also added dispose for computed. I felt it made sense since it could now apply to scoped proxies as well as global.

The main big difference from `valtio-reactive` and this plugin port is the fact that it uses `valtio-plugin`'s lifecycle hooks to send a simple `reportUsage` function on reads to the reactive core rather than the core code subscribing and does something similar for writes using `reportChange`. These replace the subscribe functionality. It's the same concept though.