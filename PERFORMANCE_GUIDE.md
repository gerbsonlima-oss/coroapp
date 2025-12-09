# Guia de Otimização de Performance

## ✅ Otimizações Implementadas

### 1. **Code Splitting Dinâmico**
- Exports PDF/ZIP carregados sob demanda
- Economiza ~630 KB no carregamento inicial
- Uso: `dynamicExportPDF()` e `dynamicExportZIP()`

### 2. **Lazy Loading de Imagens**
- Component `LazyImage` com Intersection Observer
- Imagens carregam apenas quando visíveis
- Uso: `<LazyImage src="..." />`

### 3. **Bundle Optimization**
- Vite manual chunks para melhor cache
- Terser minification com drop_console
- Separação de vendors, UI, exports, utils

### 4. **Performance Utilities**
- `withMemo()`: Memoização de componentes
- `debounce()`: Reduz chamadas de função
- `throttle()`: Limita frequência de execução

### 5. **Navigation Caching**
- Última rota por seção salva em localStorage
- Restaura estado ao trocar de aba
- Mantém scroll position e filtros

### 6. **Local Storage State**
- Filtros salvos por página
- Naipe do usuário persistido
- Grupos colapsados preservados

## 📊 Tamanho de Bundle

### Antes das Otimizações:
- **EventDetails**: 690 KB
- **jspdf + html2canvas**: Carregados sempre
- **Total**: ~5.2 MB

### Depois das Otimizações:
- **EventDetails**: ~500 KB (após split)
- **Exports**: Carregados só quando usados (~630 KB)
- **Total inicial**: ~4.5 MB
- **Redução**: ~13% no carregamento inicial

## 🚀 Como Usar as Otimizações

### Lazy Load Componentes
```typescript
const HeavyComponent = lazy(() => import('./Heavy'));
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Usar LazyImage
```typescript
<LazyImage 
  src="large-image.png" 
  className="w-full"
/>
```

### Memoizar Componentes de Lista
```typescript
const ListItem = withMemo(({ item }) => (
  <div>{item.name}</div>
));
```

### Debounce em Inputs
```typescript
const handleSearch = debounce((query) => {
  setSearchQuery(query);
}, 300);
```

## 📱 Performance Mobile

### Recomendações:
1. Use Network Throttling no DevTools para testar
2. Teste com 4G lento e 3G
3. Monitore Core Web Vitals
4. Use Lighthouse para auditoria

### Monitores Importantes:
- **FCP** (First Contentful Paint): < 1.8s
- **LCP** (Largest Contentful Paint): < 2.5s
- **CLS** (Cumulative Layout Shift): < 0.1
- **TTI** (Time to Interactive): < 3.8s

## 🔄 Próximas Otimizações Sugeridas

1. **Compressão de Imagens**
   - Converter logo e brasão para WebP
   - Reduzir de 1.9 MB para ~200 KB

2. **Virtual Scrolling**
   - Para listas longas (100+ itens)
   - Biblioteca `react-window` ou `react-virtual`

3. **Service Worker Estratégico**
   - Cache API responses
   - Sync offline changes

4. **Streaming**
   - Usar React Server Components (future)
   - Progressive hydration

## 📈 Monitoramento

### Ferramentas:
- **Chrome DevTools Lighthouse**
- **WebPageTest**
- **GTmetrix**
- **Sentry** (para erros em prod)

### Métricas a Acompanhar:
```javascript
// Performance Observer
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});

observer.observe({ entryTypes: ['measure', 'navigation'] });
```

## ⚡ Dicas Gerais

1. **Cache Agressivo**
   - PWA já implementado
   - Aumentar tempo de cache para assets estáticos

2. **Compressão**
   - Ativar gzip/brotli no servidor

3. **CDN**
   - Servir assets de CDN geográfico

4. **Prefetch/Preload**
   - Para próximas páginas prováveis

5. **Batch Updates**
   - Agrupar state updates com flushSync

---

**Última atualização**: 2025-12-08
**Performance Score**: ~85 (Lighthouse mobile)
