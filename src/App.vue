<template>
  <div>
    <img src="./assets/logo.png" alt="">
    <h1>h1 QVite</h1>
    <p>{{message}}</p>
    <p>{{title}}</p>
  </div>
</template>

<script>
import { ref } from 'vue';

export default {
  setup(props) {
    const title = ref('我是标题');

    setInterval(() => {
      title.value = title.value.split('').reverse().join('');
    }, 1000);

    return {
      title,
      message: '我是vite的mini版本'
    }
  }
}
</script>

<style>
p{color: red}
</style>