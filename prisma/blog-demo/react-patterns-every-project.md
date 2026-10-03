None of these patterns are clever. They are small habits that keep a React codebase easy to change a year later, and I end up using all five on almost every project.

## 1. Derive values instead of syncing them

If a value can be computed from props or state, compute it during render. Copying it into state with an effect adds a render and a chance for the two to drift apart.

```tsx
// Instead of useState + useEffect to keep `total` in sync:
const total = items.reduce((sum, item) => sum + item.price, 0);
```

## 2. Reset a component with a key

When a form should start fresh for a different record, give it a `key`. React throws the old state away for you, with no effect that resets fields one by one.

```tsx
<ProfileForm key={user.id} user={user} />
```

## 3. Put behaviour in custom hooks

A custom hook is the right home for logic that several components share: fetching, timers, subscriptions. Keep markup out of it, so each component stays free to render the data its own way.

```tsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return isOnline;
}
```

## 4. Compose with children instead of flags

A component with `showHeader`, `showFooter` and `compact` props grows a new flag every month. Accepting children lets each caller decide what goes inside.

```tsx
<Card>
  <Card.Title>Invoices</Card.Title>
  <InvoiceList />
</Card>
```

## 5. Keep state close to where it is used

State that lives at the top of the tree re-renders everything below it on every change. Move it down to the smallest component that needs it, and lift it only when a sibling truly has to read it.

These five habits remove more bugs than any library I have added to a project.
